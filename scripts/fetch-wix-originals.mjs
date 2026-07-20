/**
 * One-off: download every Wix-hosted original into public/images/ with a
 * semantic name, and write src/lib/image-manifest.json (name → intrinsic
 * width/height/format) for use by the local image pipeline.
 *
 * These are Sabdia's own photographs (originally from the company Dropbox);
 * Wix was only ever the hosting, so downloading is reclaiming, not taking.
 *
 * Run: node scripts/fetch-wix-originals.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const MEDIA = 'https://static.wixstatic.com/media/';

// mediaId → local base name (extension follows the original format)
const MAP = {
  '1cc2db_f012027bbf0c45ebb4ae6d847309d59f~mv2.png': 'logo',
  '1cc2db_4e48586f78704fc3ae5d00ddb8a125ee~mv2.jpg': 'home-hero-1',
  '1cc2db_9e730867446c414c9fe72c1549cb7261~mv2.jpg': 'home-hero-2',
  '1cc2db_5186783e26c04be6ab983f26b9b78377~mv2.jpg': 'solace-hero',
  '1cc2db_7d6ddb5093af4f3eb6b9d3acd088be79~mv2.png': 'agent-portrait',
  '1cc2db_a11d808ebc4648de9b8a25918f19e192~mv2.png': 'collection-calle',
  '1cc2db_4d7d30024fef47ba8f5f9859e08bb47b~mv2.jpeg': 'collection-encanto',
  '1cc2db_9ed4e50eba3b453885aa6a4917ba5607~mv2.jpg': 'collection-nero',
  '1cc2db_9cbfa41ef2dd4ed3b14b5277765cc446~mv2.jpg': 'collection-hermosa',
  '1cc2db_fb04f5dbe53b4d34ab710537a2e24b40~mv2.jpg': 'collection-fraser',
  '1cc2db_64f35b15dd914a189eee2aeb79b86284~mv2.jpg': 'collection-petra',
  '1cc2db_74fc877fe2204d2a98e663d0c7df421b~mv2.png': 'caspian-hero',
  '1cc2db_62a0dd9b4ea14ac390c3e94abab03d56~mv2.png': 'sierra-hero',
  '1cc2db_f85ca82c83644534943559cb4b0067c9~mv2.png': 'qasr-hero',
  '1cc2db_e8590ba3e20e4a3aa61c5fabafcae28b~mv2.png': 'capri-hero',
  '1cc2db_7d5ad42861414a26bf1236edfa6e4603~mv2.png': 'aether-hero',
};

await mkdir('public/images', { recursive: true });
const manifest = {};

for (const [id, name] of Object.entries(MAP)) {
  const res = await fetch(MEDIA + id);
  if (!res.ok) {
    console.error(`FAILED ${res.status}  ${name}  (${id})`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  // Wix stores some photographs as PNG (huge). Keep true graphics (the
  // logo, anything with alpha) as PNG; flatten opaque photos to q90 JPEG.
  const isPhoto = !meta.hasAlpha && buf.length > 300_000;
  const ext = isPhoto ? 'jpg' : (meta.format === 'jpeg' ? 'jpg' : meta.format);
  const out = isPhoto && meta.format !== 'jpeg'
    ? await sharp(buf).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    : buf;
  const file = `public/images/${name}.${ext}`;
  await writeFile(file, out);
  manifest[name] = { file: `/images/${name}.${ext}`, width: meta.width, height: meta.height, wixId: id };
  console.log(`${name}.${ext}  ${meta.width}×${meta.height}  ${(out.length / 1024).toFixed(0)}KB (was ${(buf.length / 1024).toFixed(0)}KB ${meta.format})`);
}

await writeFile('src/lib/image-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nManifest written: ${Object.keys(manifest).length} images.`);
