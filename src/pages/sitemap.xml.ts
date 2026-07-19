import type { APIRoute } from 'astro';
import { getProperties } from '../lib/db.js';

const STATIC_PATHS = [
  '/',
  '/about/',
  '/services/',
  '/projects/',
  '/collection/',
  '/properties/',
  '/contact/',
  '/agent-access/',
];

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://www.sabdiaconstructions.com.au')).origin;
  const props = await getProperties();

  const urls = [
    ...STATIC_PATHS.map((p) => ({ loc: `${base}${p}`, priority: p === '/' ? '1.0' : '0.7' })),
    ...props.map((p) => ({ loc: `${base}/properties/${p.id}/`, priority: '0.8' })),
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
