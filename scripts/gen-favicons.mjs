/**
 * One-off: build the favicon/app-icon set from the self-hosted logo.
 * The logo is a light wordmark, so icons sit it on the brand ink so it
 * reads in any browser theme. Outputs into public/.
 *
 * Run: node scripts/gen-favicons.mjs
 */
import sharp from 'sharp';

const INK = '#292319';
/* The full wordmark is illegible at 32px; use the leading "S" letterform
   cropped from the wordmark itself so the tile stays the brand's own type. */
const wordmark = sharp('public/images/logo.png').trim();
const wm = await wordmark.png().toBuffer({ resolveWithObject: true });
const sWidth = Math.round(wm.info.width * 0.155);
const logo = sharp(wm.data).extract({ left: 0, top: 0, width: sWidth, height: wm.info.height }).trim();
const { data: trimmed, info } = await logo.png().toBuffer({ resolveWithObject: true });

async function icon(size, out, pad = 0.18) {
  const inner = Math.round(size * (1 - pad * 2));
  const scale = inner / Math.max(info.width, info.height);
  const w = Math.round(info.width * scale);
  const h = Math.round(info.height * scale);
  /* The wordmark is ink-on-transparent; recolour the glyph gold so it
     carries against the dark tile. */
  const glyph = await sharp(trimmed).resize(w, h).png().toBuffer();
  const mark = await sharp({ create: { width: w, height: h, channels: 4, background: '#C3A96B' } })
    .composite([{ input: glyph, blend: 'dest-in' }])
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: mark, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png()
    .toFile(out);
  console.log(out);
}

await icon(32, 'public/favicon-32.png', 0.22);
await icon(16, 'public/favicon-16.png', 0.14);
await icon(180, 'public/apple-touch-icon.png');
await icon(512, 'public/icon-512.png');
console.log('done');
