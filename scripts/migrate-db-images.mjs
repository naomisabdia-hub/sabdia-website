/**
 * One-off, approved by Naomi 2026-07-20: repoint every static.wixstatic.com
 * URL stored in the production Supabase content tables at the self-hosted
 * masters in public/images/ (same mapping as the seed rewrite).
 *
 * Safety: every touched table is exported in full to
 * supabase/backups/<date>-pre-image-migration/ BEFORE any write. Restore by
 * upserting a backup file back over the table.
 *
 * Run: node scripts/migrate-db-images.mjs          (dry run — reports only)
 *      node scripts/migrate-db-images.mjs --write  (backs up, then writes)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const envText = await readFile('.env', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const manifest = JSON.parse(await readFile('src/lib/image-manifest.json', 'utf8'));
const byWixId = Object.fromEntries(Object.values(manifest).map((e) => [e.wixId, e.file]));
const RE = /https:\/\/static\.wixstatic\.com\/media\/([A-Za-z0-9_~.]+?~mv2\.\w+)(?:\/v1\/[^"'\s)\\]*)?/g;

const WRITE = process.argv.includes('--write');
const TABLES = { properties: 'id', site_content: 'key', services: 'id', process_steps: 'id', testimonials: 'id' };
const stamp = new Date().toISOString().slice(0, 10);
const backupDir = `supabase/backups/${stamp}-pre-image-migration`;

let totalRefs = 0, unmapped = 0;

for (const [table, pk] of Object.entries(TABLES)) {
  const { data: rows, error } = await supabase.from(table).select('*');
  if (error) { console.error(`${table}: read failed — ${error.message}`); process.exit(1); }

  const dirty = [];
  for (const row of rows) {
    const before = JSON.stringify(row);
    let misses = 0;
    const after = before.replace(RE, (whole, id) => {
      totalRefs++;
      if (byWixId[id]) return byWixId[id];
      misses++; unmapped++;
      console.error(`  UNMAPPED in ${table}/${row[pk]}: ${id}`);
      return whole;
    });
    if (after !== before && !misses) dirty.push(JSON.parse(after));
  }
  console.log(`${table}: ${rows.length} rows, ${dirty.length} need rewriting`);

  if (WRITE && dirty.length) {
    await mkdir(backupDir, { recursive: true });
    await writeFile(`${backupDir}/${table}.json`, JSON.stringify(rows, null, 2));
    for (const row of dirty) {
      const { error: e } = await supabase.from(table).update(row).eq(pk, row[pk]);
      if (e) { console.error(`  WRITE FAILED ${table}/${row[pk]}: ${e.message}`); process.exit(1); }
    }
    console.log(`  backed up → ${backupDir}/${table}.json, ${dirty.length} rows updated`);
  }
}
console.log(`\n${WRITE ? 'DONE' : 'DRY RUN'}: ${totalRefs} wix refs seen, ${unmapped} unmapped.`);
if (!WRITE) console.log('Re-run with --write to apply.');
