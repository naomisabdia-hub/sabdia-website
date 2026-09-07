import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * One-button site audit for the admin portal: crawls the public site's
 * own pages and reports broken links, images missing alt text, and
 * search-listing problems. Bounded (≤40 pages, ≤120 asset checks) so a
 * run stays inside one request.
 *
 * Auth: admin bearer token via is_admin_user() — same as /api/status.
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

const SEEDS = ['/', '/about/', '/services/', '/projects/', '/collection/', '/contact/',
  '/agent-access/', '/find-your-home/', '/properties/', '/journal/', '/privacy/', '/terms/', '/accessibility/'];

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAdmin(request))) return json({ error: 'Sign in to the admin portal first.' }, 401);

  const host = env('VERCEL_PROJECT_PRODUCTION_URL');
  const base = host ? `https://${host}` : new URL(request.url).origin;

  const issues: { kind: string; page: string; detail: string }[] = [];
  const pages = new Map<string, string>();

  const fetchPage = async (path: string) => {
    try {
      const r = await fetch(base + path, { headers: { 'User-Agent': 'sabdia-audit' } });
      if (r.status !== 200) {
        issues.push({ kind: 'Broken page', page: path, detail: `returns HTTP ${r.status}` });
        return null;
      }
      return await r.text();
    } catch (e: any) {
      issues.push({ kind: 'Broken page', page: path, detail: e?.message ?? 'fetch failed' });
      return null;
    }
  };

  for (const p of SEEDS) {
    const html = await fetchPage(p);
    if (html) pages.set(p, html);
  }
  // one hop of discovered internal links (property, collection, journal pages)
  const discovered = new Set<string>();
  for (const html of pages.values()) {
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      let u = m[1];
      if (u.startsWith('/api/') || u.startsWith('/admin') || u.startsWith('/cdn') || u.includes('.')) continue;
      if (!u.endsWith('/')) u += '/';
      if (!pages.has(u)) discovered.add(u);
    }
  }
  for (const p of [...discovered].slice(0, 40 - pages.size)) {
    const html = await fetchPage(p);
    if (html) pages.set(p, html);
  }

  // per-page checks
  for (const [path, html] of pages) {
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    if (!desc) issues.push({ kind: 'Search listing', page: path, detail: 'no search description' });
    else if (desc.length < 70) issues.push({ kind: 'Search listing', page: path, detail: `description very short (${desc.length} chars)` });
    else if (desc.length > 165) issues.push({ kind: 'Search listing', page: path, detail: `description long (${desc.length} chars — Google trims ~160)` });
    if (!/<title>[^<]+<\/title>/.test(html)) issues.push({ kind: 'Search listing', page: path, detail: 'missing page title' });

    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      const alt = tag.match(/alt="([^"]*)"/);
      const src = tag.match(/src="([^"]{0,90})/)?.[1] ?? '';
      if (!alt) issues.push({ kind: 'Image alt text', page: path, detail: `image missing alt (${src})` });
    }
  }

  // asset + internal-link spot checks (bounded)
  const assets = new Set<string>();
  for (const [, html] of pages) {
    for (const m of html.matchAll(/(?:src|content)="((?:https?:\/\/[^"]+|\/(?:api\/img|images)[^"]*))"/g)) {
      const u = m[1];
      if (/\.(jpg|jpeg|png|webp)|api\/img/.test(u)) assets.add(u.startsWith('http') ? u : base + u);
    }
  }
  const checkOne = async (u: string) => {
    try {
      const r = await fetch(u, { headers: { Range: 'bytes=0-0', 'User-Agent': 'sabdia-audit' } });
      if (r.status !== 200 && r.status !== 206) {
        issues.push({ kind: 'Broken image', page: '', detail: `HTTP ${r.status}: ${u.slice(0, 110)}` });
      }
    } catch {
      issues.push({ kind: 'Broken image', page: '', detail: `unreachable: ${u.slice(0, 110)}` });
    }
  };
  const sample = [...assets].slice(0, 120);
  for (let i = 0; i < sample.length; i += 8) await Promise.all(sample.slice(i, i + 8).map(checkOne));

  return json({
    base,
    pagesChecked: pages.size,
    assetsChecked: sample.length,
    issues,
    ranAt: new Date().toISOString(),
  });
};
