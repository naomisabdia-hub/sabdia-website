#!/usr/bin/env node
/**
 * Apply a prepared "The Series" list to every residence on Shopify.
 *
 * Reads shopify-app/series-posts.json — { "<product or page handle>":
 * [ { id, date, type, caption, url, thumb, hidden? }, … ], … } — and
 * writes each list into that residence's custom.series_posts metafield
 * (the JSON the theme's series-strip section renders). Handles are looked
 * up at run time, so the file stays valid if ids change.
 *
 *   node shopify-app/apply-series.mjs            # write
 *   node shopify-app/apply-series.mjs --dry-run  # report only
 *
 * The file was last built on 2026-09-14 from a capture of the @_sabdia feed
 * (every reel, carousel and photo whose caption names a residence; thumbs
 * copied to Supabase media/series/ig/). Once the real Instagram sync runs
 * (docs/INSTAGRAM-SERIES.md) it takes over: entries here carry an `id`,
 * so the sync treats them as synced posts and replaces them with its own.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const env = { ...process.env };
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch { /* env from the shell */ }
const STORE = env.SHOPIFY_STORE, TOKEN = env.SHOPIFY_ADMIN_TOKEN;
if (!STORE || !TOKEN) { console.error('✖ SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN are required (.env).'); process.exit(1); }

async function gql(query, variables = {}) {
  const r = await fetch(`https://${STORE}/admin/api/2026-07/graphql.json`, {
    method: 'POST', headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const out = await r.json();
  if (out.errors) throw new Error('Shopify: ' + JSON.stringify(out.errors).slice(0, 500));
  return out.data;
}

const lists = JSON.parse(fs.readFileSync(path.join(ROOT, 'shopify-app', 'series-posts.json'), 'utf8'));
const d = await gql(`{ products(first: 50) { nodes { id handle title } }
  pages(first: 100) { nodes { id handle title templateSuffix } } }`);
const owners = new Map();
for (const n of d.products.nodes) owners.set(n.handle, n);
for (const n of d.pages.nodes) if (n.templateSuffix === 'collection-item') owners.set(n.handle, n);

console.log(DRY ? '── Dry run (no writes) ──' : '── Applying The Series lists ──');
let written = 0;
for (const [handle, entries] of Object.entries(lists)) {
  const owner = owners.get(handle);
  if (!owner) { console.warn(`⚠ ${handle}: no product or Collection page with that handle — skipped`); continue; }
  const newest = entries.map((e) => e.date).sort().reverse()[0] ?? '-';
  console.log(`  ${owner.title.padEnd(10)} ${String(entries.length).padStart(3)} posts  newest ${newest}`);
  if (DRY) continue;
  const r = await gql(
    `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
    { m: [{ ownerId: owner.id, namespace: 'custom', key: 'series_posts', type: 'json', value: JSON.stringify(entries) }] },
  );
  const ue = r.metafieldsSet.userErrors;
  if (ue.length) { console.error(`✖ ${owner.title}: ${JSON.stringify(ue)}`); process.exitCode = 1; } else written++;
}
if (!DRY) console.log(`✔ ${written} residence(s) updated — the strips are live immediately (SSR, no theme push needed).`);
