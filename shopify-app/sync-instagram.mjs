#!/usr/bin/env node
/**
 * The Series, fed automatically from Instagram.
 *
 * Pulls every post from the @_sabdia Instagram account, works out which
 * residence each one documents (by name or hashtag in the caption), copies
 * the media onto Shopify Files so nothing ever expires, and writes the
 * result into the residence's `custom.series_posts` metafield — the JSON
 * the theme's "The Series" strip already renders. Everything lives on
 * Shopify: the posts in product/page metafields, the images and reels in
 * Files, the Instagram token in a private shop metafield.
 *
 *   node shopify-app/sync-instagram.mjs            # sync
 *   node shopify-app/sync-instagram.mjs --check    # verify setup, no writes
 *   node shopify-app/sync-instagram.mjs --dry-run  # show what would change
 *
 * Env (from the shell or the repo's .env):
 *   SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN   — the Sabdia custom app (needs the
 *                                          write_files scope as well)
 *   INSTAGRAM_ACCESS_TOKEN               — one long-lived token to bootstrap;
 *                                          after that the script keeps its own
 *                                          refreshed copy in Shopify
 *   SYNC_VIDEOS=0                        — skip copying reel mp4s (default on)
 *   SERIES_TYPES=REEL,CAROUSEL           — which post types to include
 *                                          (default REEL,CAROUSEL,IMAGE; Stories
 *                                          are never pulled — Instagram keeps
 *                                          them off the posts feed)
 *
 * ⛔ Content rule: this only ever copies media Sabdia already published.
 * It never generates imagery.
 *
 * How a post is matched to a residence — the caption contains either
 *   • the residence name as a whole word (AETHER, Aether, …), or
 *   • #<name> as a hashtag (#aether, #aetherbysabdia), or
 *   • any of the keywords in the residence's `custom.series_tags`
 *     metafield ("Series keywords" in the Shopify admin), which also lets
 *     a name-clash be avoided: put "-" as the only keyword to turn matching
 *     off for that residence, or list exact hashtags instead of the name.
 *
 * Entries the script wrote carry an `id` (the Instagram media id) and are
 * refreshed each run. Entries without one were added by hand and are left
 * alone. Add `"hidden": true` to any entry in the metafield to keep it out
 * of the strip without it coming back on the next sync.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const DRY = CHECK || args.has('--dry-run');

/* ── env ─────────────────────────────────────────────────────────────── */
const env = { ...process.env };
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch { /* no .env — CI passes everything through the environment */ }

const STORE = env.SHOPIFY_STORE;
const TOKEN = env.SHOPIFY_ADMIN_TOKEN;
const SYNC_VIDEOS = env.SYNC_VIDEOS !== '0';
const SERIES_TYPES = new Set((env.SERIES_TYPES || 'REEL,CAROUSEL,IMAGE').toUpperCase().split(',').map((t) => t.trim()));
const typeOf = (m) => (m.media_type === 'VIDEO' ? 'REEL' : m.media_type === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : 'IMAGE');
const IG_API = (env.INSTAGRAM_API_BASE || 'https://graph.instagram.com').replace(/\/$/, '') + '/v25.0'; // INSTAGRAM_API_BASE lets a local stand-in feed be used for testing
const IG_NS = '$app:instagram';
const TOKEN_LIFETIME_DAYS = 60;
const REFRESH_WHEN_UNDER_DAYS = 20;
const MAX_CAPTION = 320;

function fail(msg) { console.error(`✖ ${msg}`); process.exit(1); }
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Shopify Admin GraphQL ───────────────────────────────────────────── */
async function gql(query, variables = {}) {
  const r = await fetch(`https://${STORE}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const out = await r.json();
  if (out.errors) throw new Error('Shopify: ' + JSON.stringify(out.errors).slice(0, 500));
  return out.data;
}
const userErrors = (payload) => {
  const ue = payload?.userErrors ?? [];
  if (ue.length) throw new Error('Shopify: ' + JSON.stringify(ue).slice(0, 500));
};

async function checkScopes() {
  const d = await gql(`{ currentAppInstallation { accessScopes { handle } } shop { id name } }`);
  const scopes = new Set(d.currentAppInstallation.accessScopes.map((s) => s.handle));
  const need = ['write_products', 'write_online_store_pages', 'write_files'];
  const missing = need.filter((s) => !scopes.has(s));
  log(`Store: ${d.shop.name} (${STORE})`);
  log(`Scopes: ${[...scopes].join(', ')}`);
  if (missing.length) {
    const msg = `The custom app is missing the ${missing.join(', ')} scope(s). ` +
      'Shopify admin → Settings → Apps and sales channels → Develop apps → the Sabdia app → ' +
      'Configuration → Admin API integration → Edit → tick "read_files" and "write_files" → Save. ' +
      'If Shopify then shows a new Admin API access token, update SHOPIFY_ADMIN_TOKEN.';
    if (DRY) { console.error(`${CHECK ? '✖' : '⚠'} ${msg}`); return { shopId: d.shop.id, ok: false }; }
    fail(msg);
  }
  return { shopId: d.shop.id, ok: true };
}

/* ── Metafield definitions (idempotent) ──────────────────────────────── */
async function ensureDefinitions() {
  for (const ownerType of ['PRODUCT', 'PAGE']) {
    const defs = [
      { name: 'The Series posts', key: 'series_posts', type: 'json',
        description: 'Instagram posts documenting this residence — filled automatically by the Instagram sync.' },
      { name: 'Series keywords', key: 'series_tags', type: 'list.single_line_text_field',
        description: 'Extra words or #hashtags that mark an Instagram post as being about this residence. Leave empty to match the residence name. Put "-" to switch matching off.' },
    ];
    for (const def of defs) {
      const d = await gql(
        `mutation($def: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $def) {
           createdDefinition { id } userErrors { code message } } }`,
        { def: { ...def, namespace: 'custom', ownerType, pin: true } },
      );
      const ue = d.metafieldDefinitionCreate.userErrors;
      const taken = ue.some((u) => u.code === 'TAKEN' || /taken|already/i.test(u.message));
      if (ue.length && !taken) throw new Error(`definition ${ownerType}.${def.key}: ${JSON.stringify(ue)}`);
      log(`  ${ownerType}.${def.key}: ${taken ? 'exists' : 'created'}`);
    }
  }
}

/* ── Residences: products + Collection pages ─────────────────────────── */
async function loadResidences() {
  const [p, g] = await Promise.all([
    gql(`{ products(first: 50) { nodes { id title handle
      posts: metafield(namespace: "custom", key: "series_posts") { value }
      tags: metafield(namespace: "custom", key: "series_tags") { value } } } }`),
    gql(`{ pages(first: 100) { nodes { id title handle templateSuffix
      posts: metafield(namespace: "custom", key: "series_posts") { value }
      tags: metafield(namespace: "custom", key: "series_tags") { value } } } }`),
  ]);
  const parse = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const mk = (n, kind) => ({
    kind, id: n.id, name: n.title.trim(), handle: n.handle,
    posts: parse(n.posts?.value, []),
    tags: parse(n.tags?.value, []).map((t) => String(t).trim()).filter(Boolean),
  });
  return [
    ...p.products.nodes.map((n) => mk(n, 'product')),
    ...g.pages.nodes.filter((n) => n.templateSuffix === 'collection-item').map((n) => mk(n, 'page')),
  ];
}

/* A residence's matchers: its keywords metafield, else its name. Each
   becomes a whole-word, case-insensitive test; "#tag" matches that hashtag. */
function matchersFor(res) {
  const words = res.tags.length ? res.tags : [res.name];
  if (words.includes('-')) return [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return words.map((w) => w.startsWith('#')
    ? new RegExp(`(^|[^\\w#])${esc(w)}(?![\\w])`, 'i')
    : new RegExp(`(^|[^\\w#])${esc(w)}(?![\\w])|#${esc(w)}\\w*`, 'i'));
}

/* ── Instagram token, kept in a private shop metafield ───────────────── */
async function loadToken(shopId) {
  const d = await gql(`{ shop {
    token: metafield(namespace: "${IG_NS}", key: "token") { value }
    issued: metafield(namespace: "${IG_NS}", key: "token_issued") { value }
    expires: metafield(namespace: "${IG_NS}", key: "token_expires") { value } } }`);
  const stored = d.shop.token?.value ? {
    token: d.shop.token.value,
    issued: new Date(d.shop.issued?.value ?? 0),
    expires: new Date(d.shop.expires?.value ?? 0),
  } : null;
  const now = Date.now();
  const bootstrap = env.INSTAGRAM_ACCESS_TOKEN?.trim();

  // A fresh token in the environment replaces a missing/expired/different-
  // and-newer stored one; otherwise the stored, self-refreshed copy wins.
  let tok = stored && stored.expires.getTime() > now ? stored : null;
  if (bootstrap && (!tok || (bootstrap !== tok.token && env.INSTAGRAM_TOKEN_RESET === '1'))) {
    tok = { token: bootstrap, issued: new Date(now), expires: new Date(now + TOKEN_LIFETIME_DAYS * 864e5) };
    log('Instagram token: using INSTAGRAM_ACCESS_TOKEN from the environment');
    if (!DRY) await saveToken(shopId, tok);
  }
  if (!tok) {
    const msg = stored
      ? `The stored Instagram token expired on ${stored.expires.toISOString().slice(0, 10)}. Generate a new one (docs/INSTAGRAM-SERIES.md) and set INSTAGRAM_ACCESS_TOKEN.`
      : 'No Instagram token yet. Generate one (docs/INSTAGRAM-SERIES.md) and set INSTAGRAM_ACCESS_TOKEN.';
    if (CHECK) { console.error(`✖ ${msg}`); return null; }
    fail(msg);
  }

  const daysLeft = (tok.expires.getTime() - now) / 864e5;
  const ageHours = (now - tok.issued.getTime()) / 36e5;
  log(`Instagram token: ${daysLeft.toFixed(0)} days left`);
  if (daysLeft < REFRESH_WHEN_UNDER_DAYS && ageHours > 24 && !DRY) {
    const r = await fetch(`${IG_API.replace(/\/v[\d.]+$/, '')}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tok.token)}`);
    const j = await r.json();
    if (j.access_token) {
      tok = { token: j.access_token, issued: new Date(now), expires: new Date(now + (j.expires_in ?? TOKEN_LIFETIME_DAYS * 86400) * 1000) };
      await saveToken(shopId, tok);
      log(`Instagram token: refreshed, now valid until ${tok.expires.toISOString().slice(0, 10)}`);
    } else {
      console.warn('⚠ Instagram token refresh failed:', JSON.stringify(j).slice(0, 300));
    }
  }
  return tok.token;
}

async function saveToken(shopId, tok) {
  const d = await gql(
    `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
    { m: [
      { ownerId: shopId, namespace: IG_NS, key: 'token', type: 'single_line_text_field', value: tok.token },
      { ownerId: shopId, namespace: IG_NS, key: 'token_issued', type: 'date_time', value: tok.issued.toISOString() },
      { ownerId: shopId, namespace: IG_NS, key: 'token_expires', type: 'date_time', value: tok.expires.toISOString() },
    ] },
  );
  userErrors(d.metafieldsSet);
}

async function saveSyncStatus(shopId, summary) {
  const d = await gql(
    `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
    { m: [{ ownerId: shopId, namespace: IG_NS, key: 'last_sync', type: 'json', value: JSON.stringify(summary) }] },
  );
  userErrors(d.metafieldsSet);
}

/* ── Instagram media ─────────────────────────────────────────────────── */
async function fetchInstagramMedia(token) {
  const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,' +
    'children{id,media_type,media_url,thumbnail_url}';
  let url = `${IG_API}/me/media?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(token)}`;
  const all = [];
  for (let page = 0; url && page < 20; page++) {
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) throw new Error(`Instagram: ${j.error.message} (code ${j.error.code})`);
    all.push(...(j.data ?? []));
    url = j.paging?.next;
  }
  return all;
}

const tidyCaption = (raw = '') => {
  let c = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  // drop a trailing block that is nothing but hashtags / mentions
  c = c.replace(/(\s*[#@][\w.]+)+\s*$/g, '').trim();
  c = c.replace(/\n{2,}/g, '\n').replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');
  if (c.length > MAX_CAPTION) c = c.slice(0, MAX_CAPTION - 1).replace(/\s+\S*$/, '') + '…';
  return c;
};

/* ── Shopify Files: copy Instagram media so it never expires ─────────── */
async function createFiles(items) {
  if (!items.length) return {};
  const d = await gql(
    `mutation($files: [FileCreateInput!]!) { fileCreate(files: $files) {
       files { id fileStatus alt } userErrors { field message code } } }`,
    { files: items.map((it) => ({
      originalSource: it.source, contentType: it.kind, alt: it.alt, filename: it.filename,
      duplicateResolutionMode: 'REPLACE',
    })) },
  );
  userErrors(d.fileCreate);
  const ids = d.fileCreate.files.map((f) => f.id);
  const byKey = {};
  items.forEach((it, i) => { byKey[it.key] = ids[i]; });

  // Poll until every file is processed (videos transcode for a while).
  const urls = {};
  const deadline = Date.now() + 8 * 60e3;
  let pending = ids;
  while (pending.length && Date.now() < deadline) {
    await sleep(3000);
    const r = await gql(`query($ids: [ID!]!) { nodes(ids: $ids) {
      ... on MediaImage { id fileStatus image { url } fileErrors { message } }
      ... on Video { id fileStatus sources { url mimeType width } fileErrors { message } } } }`, { ids: pending });
    pending = [];
    for (const n of r.nodes) {
      if (!n) continue;
      if (n.fileStatus === 'READY') {
        if (n.image?.url) urls[n.id] = n.image.url;
        else if (n.sources?.length) {
          const mp4 = n.sources.filter((s) => /mp4/i.test(s.mimeType ?? s.url)).sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
          urls[n.id] = (mp4[0] ?? n.sources[0]).url;
        }
      } else if (n.fileStatus === 'FAILED') {
        console.warn(`⚠ file ${n.id} failed: ${n.fileErrors?.map((e) => e.message).join('; ')}`);
      } else pending.push(n.id);
    }
  }
  if (pending.length) console.warn(`⚠ ${pending.length} file(s) still processing — they will be picked up next run.`);
  const out = {};
  for (const [key, id] of Object.entries(byKey)) if (urls[id]) out[key] = urls[id];
  return out;
}

/* ── Main ────────────────────────────────────────────────────────────── */
async function main() {
  if (!STORE || !TOKEN) fail('SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN are required.');
  log(DRY ? (CHECK ? '── Check mode (no writes) ──' : '── Dry run (no writes) ──') : '── Instagram → The Series ──');
  const { shopId, ok } = await checkScopes();

  log('Metafield definitions:');
  if (DRY) log('  (skipped in check/dry-run)'); else await ensureDefinitions();

  const residences = await loadResidences();
  log(`Residences: ${residences.length}`);
  for (const r of residences) {
    const m = r.tags.length ? r.tags.join(', ') : `name "${r.name}" / #${r.name.toLowerCase()}…`;
    log(`  ${r.kind === 'page' ? 'page   ' : 'product'} ${r.name.padEnd(10)} ${String(r.posts.length).padStart(2)} posts  matches: ${r.tags.includes('-') ? 'off' : m}`);
  }

  const token = await loadToken(shopId);
  if (CHECK) { log(ok && token ? '✔ Setup complete — run without --check to sync.' : '✖ Setup incomplete (see above).'); process.exit(ok && token ? 0 : 1); }

  const media = await fetchInstagramMedia(token);
  log(`Instagram: ${media.length} posts fetched`);

  const summary = { at: new Date().toISOString(), fetched: media.length, residences: {} };
  const uploads = [];
  const plans = [];

  for (const res of residences) {
    const tests = matchersFor(res);
    if (!tests.length) continue;
    const matched = media.filter((m) => SERIES_TYPES.has(typeOf(m)) && tests.some((t) => t.test(m.caption ?? '')));
    if (!matched.length && !res.posts.some((p) => p.id)) continue;

    const existing = new Map(res.posts.filter((p) => p.id).map((p) => [String(p.id), p]));
    const manual = res.posts.filter((p) => !p.id);
    const next = [];

    for (const m of matched) {
      const prev = existing.get(String(m.id)) ?? {};
      const type = typeOf(m);
      const isVideo = type === 'REEL';
      const isCarousel = type === 'CAROUSEL';
      const entry = {
        ...prev,
        id: String(m.id),
        date: (m.timestamp ?? '').slice(0, 10),
        type,
        caption: tidyCaption(m.caption),
        url: m.permalink,
        thumb: prev.thumb || '',
      };
      const base = `series-${res.handle.replace(/^collection-/, '')}-${m.id}`;
      const poster = isVideo ? m.thumbnail_url : m.media_url;
      if (!entry.thumb && poster) uploads.push({ key: `${m.id}:thumb`, source: poster, kind: 'IMAGE', alt: `${res.name} — ${entry.caption || 'Instagram post'}`.slice(0, 250), filename: `${base}.jpg`, set: (u) => { entry.thumb = u; } });
      if (isVideo && SYNC_VIDEOS && !entry.video && m.media_url) uploads.push({ key: `${m.id}:video`, source: m.media_url, kind: 'VIDEO', alt: `${res.name} — reel`, filename: `${base}.mp4`, set: (u) => { entry.video = u; } });
      if (isCarousel && !entry.slides?.length && m.children?.data?.length) {
        entry.slides = [];
        m.children.data.forEach((c, i) => {
          const src = c.media_type === 'VIDEO' ? c.thumbnail_url : c.media_url;
          if (!src) return;
          const idx = entry.slides.push('') - 1;
          uploads.push({ key: `${m.id}:slide:${i}`, source: src, kind: 'IMAGE', alt: `${res.name} — slide ${i + 1}`, filename: `${base}-${i + 1}.jpg`, set: (u) => { entry.slides[idx] = u; } });
        });
      }
      next.push(entry);
    }

    // Synced entries whose post has since been deleted on Instagram drop out;
    // hand-added ones stay. Newest first.
    const all = [...next, ...manual].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    plans.push({ res, all, matched: next.length });
    summary.residences[res.handle] = { matched: next.length, manual: manual.length };
    log(`  ${res.name.padEnd(10)} ${next.length} Instagram post(s) matched` + (manual.length ? `, ${manual.length} kept by hand` : ''));
  }

  if (DRY) {
    log(`Would copy ${uploads.length} file(s) to Shopify Files and update ${plans.length} residence(s).`);
    for (const p of plans) for (const e of p.all) log(`    ${p.res.name.padEnd(8)} ${e.date}  ${(e.type ?? 'manual').padEnd(8)} ${e.caption?.slice(0, 70) ?? ''}`);
    return;
  }

  if (uploads.length) {
    log(`Copying ${uploads.length} file(s) to Shopify Files…`);
    for (let i = 0; i < uploads.length; i += 10) {
      const batch = uploads.slice(i, i + 10);
      const got = await createFiles(batch);
      for (const u of batch) if (got[u.key]) u.set(got[u.key]);
    }
  }

  let updated = 0;
  for (const { res, all } of plans) {
    const clean = all.map((e) => {
      const o = { ...e };
      if (o.slides) o.slides = o.slides.filter(Boolean);
      if (!o.slides?.length) delete o.slides;
      if (!o.video) delete o.video;
      return o;
    }).filter((e) => e.thumb || e.video || e.caption);
    const value = JSON.stringify(clean);
    if (value === JSON.stringify(res.posts)) continue;
    const d = await gql(
      `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
      { m: [{ ownerId: res.id, namespace: 'custom', key: 'series_posts', type: 'json', value }] },
    );
    userErrors(d.metafieldsSet);
    updated++;
    log(`  ✔ ${res.name}: ${clean.length} posts written`);
  }
  summary.updated = updated;
  await saveSyncStatus(shopId, summary);
  log(`Done — ${updated} residence(s) updated.`);
}

export { matchersFor, tidyCaption };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => fail(e.message));
}
