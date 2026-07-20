/**
 * Self-hosted image pipeline (replaces the old lib/wix.js hotlinks).
 *
 * Masters live in public/images/ (see scripts/fetch-wix-originals.mjs and
 * image-manifest.json); admin uploads live in the Supabase `media` bucket.
 * Both are served resized/cropped as WebP by the /api/img endpoint, which
 * keeps the exact crop-with-focal-point semantics the design was built on.
 */
import manifest from './image-manifest.json';

const SUPABASE_MEDIA = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//;

/** Manifest entry for a master, by '/images/…' path or bare name. Null for anything else. */
export function imageInfo(src) {
  if (!src) return null;
  const name = String(src).replace(/^\/images\//, '').replace(/\.\w+$/, '');
  return manifest[name] ?? null;
}

/**
 * A resized, focal-cropped WebP variant of an owned image.
 * `focus` keeps the Wix-era string format ("fp_0.5_0.65") so existing
 * property rows don't need their focus values rewritten.
 * Sources that aren't ours (or are SVGs) pass through untouched.
 */
export function imgVariant(src, { w, h, focus = '', q = 82 }) {
  if (!src) return src;
  const local = src.startsWith('/images/');
  const remote = SUPABASE_MEDIA.test(src);
  if ((!local && !remote) || /\.svg$/i.test(src)) return src;
  const p = new URLSearchParams({ src, w: String(Math.round(w)), h: String(Math.round(h)) });
  if (focus) p.set('fp', focus);
  if (q !== 82) p.set('q', String(q));
  return `/api/img?${p.toString()}`;
}

/** "1000m²+" or "632m²" for spec rows and cards. */
export function landLabel(land, landOver) {
  return `${land}m²${landOver ? '+' : ''}`;
}

const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** Number as a word for prose ("Four extraordinary residences…"). */
export function countWord(n) {
  return words[n] ?? String(n);
}
