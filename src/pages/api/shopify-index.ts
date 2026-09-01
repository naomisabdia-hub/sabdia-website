import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Search index over the SHOPIFY copy of the site — every editable string
 * with a deep link to the exact Shopify screen that edits it. Powers
 * Admin → Shopify, the ⌘K-style "search every sentence" Shopify itself
 * doesn't have.
 *
 * Sources: the live theme's template JSON (customizer copy + theme
 * settings) via the Theme Access proxy, and products / pages / blog via
 * the Admin API. Strings still sitting on a section's built-in default
 * (never edited in the customizer) live in the theme code, not the
 * templates, so they appear here after their first edit.
 *
 * Auth: admin bearer token, verified via is_admin_user() — same pattern
 * as /api/status. Needs SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN +
 * SHOPIFY_CLI_THEME_TOKEN in the environment.
 */

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const env = (key: string) => import.meta.env[key] ?? process.env[key];

async function isAdmin(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY') ?? env('PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) return false;
  const resp = await fetch(`${url}/rest/v1/rpc/is_admin_user`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return resp.ok && (await resp.json()) === true;
}

type Entry = { text: string; where: string; url: string; group: string };

const THEME_ID = env('SHOPIFY_THEME_ID') ?? '150554902630';

/* Which storefront page each template previews at, for customizer links. */
const TEMPLATE_PATH: Record<string, string> = {
  'index': '/',
  'product': '/products/qasr',
  'collection': '/collections/for-sale',
  'blog': '/blogs/journal',
  'page': '/pages/privacy',
  'page.about': '/pages/about',
  'page.services': '/pages/services',
  'page.projects': '/pages/projects',
  'page.collection': '/pages/collection',
  'page.contact': '/pages/contact',
  'page.agent-access': '/pages/agent-access',
  'page.find-your-home': '/pages/find-your-home',
  'page.collection-item': '/pages/collection-milos',
  '404': '/does-not-exist',
};

const looksLikeCopy = (v: string) =>
  v.length > 1 && !/^https?:\/\//.test(v) && !v.startsWith('/') && !/^#?[0-9a-f]{6}$/i.test(v) && !/^shopify:\/\//.test(v);

function harvest(node: unknown, trail: string[], out: { text: string; where: string }[]) {
  if (typeof node === 'string') {
    if (looksLikeCopy(node)) out.push({ text: node, where: trail.join(' › ') });
    return;
  }
  if (Array.isArray(node)) { node.forEach((v, i) => harvest(v, [...trail, String(i + 1)], out)); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type') continue;
      harvest(v, [...trail, k.replace(/_/g, ' ')], out);
    }
  }
}

/* One-minute in-memory cache — building the index is ~20 upstream calls. */
let cache: { at: number; entries: Entry[] } | null = null;

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAdmin(request))) return json({ error: 'Sign in to the admin portal first.' }, 401);

  const store = env('SHOPIFY_STORE');
  const adminToken = env('SHOPIFY_ADMIN_TOKEN');
  const themeToken = env('SHOPIFY_CLI_THEME_TOKEN');
  if (!store || !adminToken || !themeToken) {
    return json({ error: 'Shopify credentials are not configured (SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN, SHOPIFY_CLI_THEME_TOKEN).' }, 503);
  }
  if (cache && Date.now() - cache.at < 60_000) return json({ entries: cache.entries, cached: true });

  const handle = store.replace('.myshopify.com', '');
  const adminBase = `https://admin.shopify.com/store/${handle}`;
  const entries: Entry[] = [];

  const gql = async (query: string) => {
    const r = await fetch(`https://${store}/admin/api/2026-07/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const out = await r.json();
    if (out.errors) throw new Error(JSON.stringify(out.errors).slice(0, 200));
    return out.data;
  };

  const themeAsset = async (key: string) => {
    const r = await fetch(
      `https://theme-kit-access.shopifyapps.com/cli/admin/api/2026-07/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      { headers: { 'X-Shopify-Access-Token': themeToken, 'X-Shopify-Shop': store } },
    );
    if (!r.ok) return null;
    const { asset } = await r.json();
    return asset?.value ?? null;
  };

  const num = (gid: string) => gid.split('/').pop();
  const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  /* ── Customizer copy: template JSON + theme settings ── */
  const templateNames = Object.keys(TEMPLATE_PATH);
  await Promise.all(
    templateNames.map(async (name) => {
      const raw = await themeAsset(`templates/${name}.json`);
      if (!raw) return;
      let doc: any;
      try { doc = JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')); } catch { return; }
      const editor = `${adminBase}/themes/${THEME_ID}/editor?previewPath=${encodeURIComponent(TEMPLATE_PATH[name])}`;
      for (const [sid, section] of Object.entries<any>(doc.sections ?? {})) {
        const found: { text: string; where: string }[] = [];
        harvest(section.settings ?? {}, [], found);
        for (const [, block] of Object.entries<any>(section.blocks ?? {})) {
          harvest(block.settings ?? {}, ['item'], found);
        }
        for (const f of found) {
          entries.push({
            text: f.text,
            where: `${TEMPLATE_PATH[name]} › ${section.type.replace(/-/g, ' ')}${f.where ? ' › ' + f.where : ''}`,
            url: editor,
            group: 'Customizer copy',
          });
        }
      }
    }),
  );
  const settingsRaw = await themeAsset('config/settings_data.json');
  if (settingsRaw) {
    try {
      const doc = JSON.parse(settingsRaw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
      const found: { text: string; where: string }[] = [];
      harvest(doc.current ?? {}, [], found);
      for (const f of found) {
        entries.push({
          text: f.text, where: `Theme settings › ${f.where}`,
          url: `${adminBase}/themes/${THEME_ID}/editor`, group: 'Customizer copy',
        });
      }
    } catch { /* settings not yet saved as JSON */ }
  }

  /* ── Properties (products) ── */
  const prod = await gql(`{ products(first: 30) { nodes { id title handle descriptionHtml
    metafields(first: 20) { nodes { key value } } } } }`);
  for (const p of prod.products.nodes) {
    const url = `${adminBase}/products/${num(p.id)}`;
    entries.push({ text: p.title, where: `Property › title`, url, group: 'Properties' });
    const desc = strip(p.descriptionHtml || '');
    if (desc) entries.push({ text: desc, where: `${p.title} › description`, url, group: 'Properties' });
    for (const m of p.metafields.nodes) {
      if (['headline', 'enquiry_heading', 'enquiry_text', 'enquiry_button', 'suburb', 'features'].includes(m.key) && m.value) {
        entries.push({ text: m.value, where: `${p.title} › ${m.key.replace(/_/g, ' ')}`, url, group: 'Properties' });
      }
    }
  }

  /* ── Pages ── */
  const pg = await gql(`{ pages(first: 50) { nodes { id title handle body } } }`);
  for (const p of pg.pages.nodes) {
    const url = `${adminBase}/pages/${num(p.id)}`;
    entries.push({ text: p.title, where: 'Page › title', url, group: 'Pages' });
    const body = strip(p.body || '');
    if (body) entries.push({ text: body, where: `${p.title} › body`, url, group: 'Pages' });
  }

  /* ── Journal ── */
  const blogs = await gql(`{ blogs(first: 5) { nodes { handle articles(first: 50) { nodes { id title body } } } } }`);
  for (const b of blogs.blogs.nodes) {
    for (const a of b.articles.nodes) {
      const url = `${adminBase}/articles/${num(a.id)}`;
      entries.push({ text: a.title, where: 'Journal › title', url, group: 'Journal' });
      const body = strip(a.body || '');
      if (body) entries.push({ text: body.slice(0, 400), where: `${a.title} › body`, url, group: 'Journal' });
    }
  }

  /* ── Menus ── */
  const menus = await gql(`{ menus(first: 10) { nodes { title items { title items { title } } } } }`);
  for (const m of menus.menus.nodes) {
    const flat = (items: any[]): string[] => items.flatMap((i) => [i.title, ...(i.items ? flat(i.items) : [])]);
    for (const t of flat(m.items)) {
      entries.push({ text: t, where: `Menu › ${m.title}`, url: `${adminBase}/menus`, group: 'Menus' });
    }
  }

  cache = { at: Date.now(), entries };
  return json({ entries });
};
