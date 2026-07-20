/**
 * One-off: repoint every static.wixstatic.com reference in the bundled seed
 * data (seed-content.json, seed-properties.json, the property markdown) at
 * the self-hosted masters in public/images/, using the wixId → file mapping
 * in src/lib/image-manifest.json. Transform suffixes (/v1/fill/…) collapse
 * to the master path — pages request sized variants via /api/img instead.
 *
 * Run: node scripts/rewrite-seed-urls.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('src/lib/image-manifest.json', 'utf8'));
const byWixId = Object.fromEntries(Object.values(manifest).map((e) => [e.wixId, e.file]));

const RE = /https:\/\/static\.wixstatic\.com\/media\/([A-Za-z0-9_~.]+?~mv2\.\w+)(?:\/v1\/[^"'\s)\\]*)?/g;

const files = ['src/lib/seed-content.json', 'src/lib/seed-properties.json'];
for await (const f of glob('src/content/properties/*.md')) files.push(f);

for (const f of files) {
  const before = await readFile(f, 'utf8');
  let misses = 0;
  const after = before.replace(RE, (whole, id) => {
    if (byWixId[id]) return byWixId[id];
    misses++;
    console.error(`  UNMAPPED in ${f}: ${id}`);
    return whole;
  });
  const n = (before.match(RE) ?? []).length;
  await writeFile(f, after);
  console.log(`${f}: ${n} refs rewritten${misses ? `, ${misses} UNMAPPED` : ''}`);
}
