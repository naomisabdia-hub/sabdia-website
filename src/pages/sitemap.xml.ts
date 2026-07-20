import type { APIRoute } from 'astro';
import { getProperties } from '../lib/db.js';
import { getContent } from '../lib/content.js';

const STATIC_PATHS = [
  '/',
  '/about/',
  '/services/',
  '/projects/',
  '/collection/',
  '/properties/',
  '/contact/',
  '/agent-access/',
  '/find-your-home/',
  '/privacy/',
  '/accessibility/',
];

const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://www.sabdiaconstructions.com.au')).origin;
  const [props, { collection_page }] = await Promise.all([getProperties(), getContent('collection_page')]);

  const urls = [
    ...STATIC_PATHS.map((p) => ({ loc: `${base}${p}`, priority: p === '/' ? '1.0' : '0.7' })),
    ...props.map((p) => ({ loc: `${base}/properties/${p.id}/`, priority: '0.8' })),
    ...(collection_page?.items ?? []).map((i: { name: string }) => ({ loc: `${base}/collection/${slugify(i.name)}/`, priority: '0.6' })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
