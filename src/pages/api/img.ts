import type { APIRoute } from 'astro';
import sharp from 'sharp';

export const prerender = false;

/**
 * Self-hosted image resizer — the replacement for Wix's /v1/fill transforms.
 *
 * GET /api/img?src=/images/caspian-hero.jpg&w=1200&h=750&fp=fp_0.5_0.65&q=85
 *
 * Sources are fetched over HTTP (public/ is on the static CDN, not the
 * function filesystem on Vercel) and restricted to our own masters under
 * /images/ or the project's public Supabase media bucket. Output is WebP,
 * cropped to exactly w×h around the focal point, cached immutably at the
 * CDN so each variant is computed once.
 */

const SUPABASE_MEDIA = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//;
const FP = /^fp_(0(?:\.\d+)?|1(?:\.0+)?)_(0(?:\.\d+)?|1(?:\.0+)?)$/;

const env = (key: string) => import.meta.env[key] ?? process.env[key];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const GET: APIRoute = async ({ url, request }) => {
  const src = url.searchParams.get('src') ?? '';
  const w = clamp(parseInt(url.searchParams.get('w') ?? '0', 10) || 0, 16, 3200);
  const h = clamp(parseInt(url.searchParams.get('h') ?? '0', 10) || 0, 16, 3200);
  const q = clamp(parseInt(url.searchParams.get('q') ?? '82', 10) || 82, 30, 95);
  const fpRaw = url.searchParams.get('fp') ?? '';

  const local = src.startsWith('/images/') && !src.includes('..');
  if ((!local && !SUPABASE_MEDIA.test(src)) || !w || !h) {
    return new Response('Bad request', { status: 400 });
  }

  /* Local masters are fetched over HTTP (public/ lives on the CDN, not the
     function filesystem). request.url inside a Vercel function carries the
     unique deployment host, which deployment protection intercepts — so on
     Vercel we fetch via the always-public production alias instead. */
  const publicHost = env('VERCEL_PROJECT_PRODUCTION_URL');
  const sourceUrl = local
    ? new URL(src, publicHost ? `https://${publicHost}` : request.url)
    : new URL(src);
  const upstream = await fetch(sourceUrl);
  if (!upstream.ok) return new Response('Source not found', { status: 404 });
  const input = Buffer.from(await upstream.arrayBuffer());

  let img = sharp(input);
  const meta = await img.metadata();
  const W = meta.width ?? w;
  const H = meta.height ?? h;

  /* Cover-crop around the focal point: scale until both axes cover the
     target, then extract the w×h window whose centre sits as close to the
     focal point as the frame allows. */
  const m = FP.exec(fpRaw);
  const fx = m ? parseFloat(m[1]) : 0.5;
  const fy = m ? parseFloat(m[2]) : 0.5;
  const scale = Math.max(w / W, h / H);
  if (scale < 1) {
    const sw = Math.max(w, Math.round(W * scale));
    const sh = Math.max(h, Math.round(H * scale));
    img = img.resize(sw, sh);
    const left = clamp(Math.round(fx * sw - w / 2), 0, sw - w);
    const top = clamp(Math.round(fy * sh - h / 2), 0, sh - h);
    img = img.extract({ left, top, width: w, height: h });
  } else {
    // Never upscale masters; centre-crop to the requested aspect instead.
    img = img.resize(w, h, { fit: 'cover', withoutEnlargement: true });
  }

  const out = await img.webp({ quality: q }).toBuffer();
  return new Response(new Uint8Array(out), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  });
};
