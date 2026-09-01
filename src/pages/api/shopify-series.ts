import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * The Instagram Series posts, editable as friendly forms (Admin →
 * Instagram Series) instead of raw JSON metafields.
 *
 * GET  → every residence (products + collection pages) with its posts.
 * PUT  → { kind, id, slug, posts } saves BOTH copies of the site in one
 *        go: the Shopify metafield (custom.series_posts) and the Astro
 *        site's site_content `series.byProject` — so the strips can
 *        never drift apart.
 *
 * Auth: admin bearer token via is_admin_user().
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

const gql = async (query: string, variables?: object) => {
  const store = env('SHOPIFY_STORE');
  const token = env('SHOPIFY_ADMIN_TOKEN');
  if (!store || !token) throw new Error('Shopify credentials are not configured.');
  const r = await fetch(`https://${store}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const out = await r.json();
  if (out.errors) throw new Error(JSON.stringify(out.errors).slice(0, 300));
  return out.data;
};

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAdmin(request))) return json({ error: 'Sign in to the admin portal first.' }, 401);
  try {
    const [prod, pages] = await Promise.all([
      gql(`{ products(first: 30) { nodes { id title handle
        metafield(namespace: "custom", key: "series_posts") { value } } } }`),
      gql(`{ pages(first: 50) { nodes { id title handle templateSuffix
        metafield(namespace: "custom", key: "series_posts") { value } } } }`),
    ]);
    const parse = (v: string | null | undefined) => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
    const residences = [
      ...prod.products.nodes.map((p: any) => ({
        kind: 'product', id: p.id, slug: p.handle, title: p.title, posts: parse(p.metafield?.value),
      })),
      ...pages.pages.nodes
        .filter((p: any) => p.templateSuffix === 'collection-item')
        .map((p: any) => ({
          kind: 'page', id: p.id, slug: p.handle.replace(/^collection-/, ''), title: `${p.title} (Collection)`, posts: parse(p.metafield?.value),
        })),
    ];
    return json({ residences });
  } catch (e: any) {
    return json({ error: e.message }, 502);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!(await isAdmin(request))) return json({ error: 'Sign in to the admin portal first.' }, 401);
  try {
    const { kind, id, slug, posts } = await request.json();
    if (!id || !slug || !Array.isArray(posts)) return json({ error: 'kind, id, slug and posts are required.' }, 400);
    const clean = posts
      .filter((p: any) => p && (p.thumb || p.video || p.caption))
      .map((p: any) => {
        const out: any = { date: p.date || '', thumb: p.thumb || '', caption: p.caption || '' };
        if (p.video) out.video = p.video;
        if (p.url) out.url = p.url;
        return out;
      });

    // 1) Shopify metafield — the strip on the Shopify site
    const d = await gql(
      `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) {
        userErrors { field message } } }`,
      { m: [{ ownerId: id, namespace: 'custom', key: 'series_posts', type: 'json', value: JSON.stringify(clean) }] },
    );
    const ue = d.metafieldsSet.userErrors;
    if (ue?.length) throw new Error(JSON.stringify(ue).slice(0, 300));

    // 2) Astro site — site_content series.byProject, so both sites match
    const su = env('SUPABASE_URL');
    const service = env('SUPABASE_SERVICE_ROLE_KEY');
    let astro = 'skipped (no service key)';
    if (su && service) {
      const h = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
      const cur = await fetch(`${su}/rest/v1/site_content?key=eq.series&select=data`, { headers: h }).then((r) => r.json());
      const doc = cur?.[0]?.data ?? {};
      doc.byProject = { ...(doc.byProject ?? {}), [slug]: clean };
      const up = await fetch(`${su}/rest/v1/site_content?on_conflict=key`, {
        method: 'POST',
        headers: { ...h, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: 'series', data: doc }),
      });
      astro = up.ok ? 'updated' : `failed (${up.status})`;
    }
    return json({ ok: true, saved: clean.length, astro });
  } catch (e: any) {
    return json({ error: e.message }, 502);
  }
};
