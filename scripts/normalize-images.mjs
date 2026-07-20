/**
 * One-off follow-up to fetch-wix-originals.mjs: normalise the downloaded
 * masters so the repo stays lean — cap the long edge at 3200px (the site
 * never serves wider; retina cards top out at 2800), and flatten PNGs whose
 * alpha channel is entirely opaque into mozjPEG. Rewrites the manifest.
 *
 * Run: node scripts/normalize-images.mjs
 */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import sharp from 'sharp';

const MANIFEST = 'src/lib/image-manifest.json';
const MAX = 3200;
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

for (const [name, entry] of Object.entries(manifest)) {
  const path = 'public' + entry.file;
  let img = sharp(path);
  const meta = await img.metadata();
  let { width, height, format, hasAlpha } = meta;

  let opaque = false;
  if (hasAlpha) {
    const stats = await img.stats();
    const alpha = stats.channels[stats.channels.length - 1];
    opaque = alpha.min === 255;
  }

  const needsResize = Math.max(width, height) > MAX;
  const toJpeg = format === 'png' && opaque && name !== 'logo';
  if (!needsResize && !toJpeg) { console.log(`keep  ${name} (${width}×${height} ${format})`); continue; }

  if (needsResize) {
    const scale = MAX / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    img = img.resize({ width, height });
  }
  if (toJpeg) img = img.flatten().jpeg({ quality: 88, mozjpeg: true });
  else if (format === 'jpeg') img = img.jpeg({ quality: 88, mozjpeg: true });

  const newFile = toJpeg ? entry.file.replace(/\.png$/, '.jpg') : entry.file;
  const buf = await img.toBuffer();
  await writeFile('public' + newFile, buf);
  if (newFile !== entry.file) await unlink(path);
  manifest[name] = { ...entry, file: newFile, width, height };
  console.log(`norm  ${name} → ${width}×${height} ${(buf.length / 1024).toFixed(0)}KB${toJpeg ? ' (png→jpg)' : ''}`);
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log('\nManifest updated.');
