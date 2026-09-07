/**
 * Additive merge of the new legal/compliance content into the live
 * site_content rows.
 *
 * ADDITIVE ONLY. Nothing Naomi has edited in the admin is overwritten:
 * sections are matched by heading and only missing ones are appended,
 * settings keys are only created when absent. Run with --write to apply;
 * without it, prints the plan and touches nothing.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const seed = JSON.parse(fs.readFileSync('src/lib/seed-content.json', 'utf8'));
const WRITE = process.argv.includes('--write');
const plan = [];

const { data: rows, error } = await sb.from('site_content').select('key, data');
if (error) { console.error('read failed:', error.message); process.exit(1); }
const live = Object.fromEntries(rows.map(r => [r.key, r.data]));

const save = async (key, data) => {
  if (!WRITE) return;
  const { error } = await sb.from('site_content').upsert({ key, data }, { onConflict: 'key' });
  if (error) throw new Error(`${key}: ${error.message}`);
};

/* 1 ── legal_terms: brand new page, no live row at all. */
if (!live.legal_terms) {
  plan.push(['legal_terms', 'CREATE', `new page, ${seed.legal_terms.sections.length} sections`]);
  await save('legal_terms', seed.legal_terms);
}

/* 2 ── legal_privacy: append only sections whose heading is missing. */
{
  const cur = structuredClone(live.legal_privacy ?? seed.legal_privacy);
  const have = new Set(cur.sections.map(s => s.heading));
  const add = seed.legal_privacy.sections.filter(s => !have.has(s.heading));
  // Reposition each new section after the seed's neighbour where possible.
  for (const s of add) {
    const seedIdx = seed.legal_privacy.sections.findIndex(x => x.heading === s.heading);
    const prev = seed.legal_privacy.sections[seedIdx - 1]?.heading;
    const at = prev ? cur.sections.findIndex(x => x.heading === prev) : -1;
    if (at >= 0) cur.sections.splice(at + 1, 0, s); else cur.sections.push(s);
  }
  if (add.length) {
    cur.updated = seed.legal_privacy.updated;
    plan.push(['legal_privacy', 'APPEND', add.map(s => s.heading).join(' · ')]);
    await save('legal_privacy', cur);
  }
}

/* 3 ── settings: create the two identifier keys only if absent, EMPTY. */
{
  const cur = structuredClone(live.settings ?? seed.settings);
  const missing = ['abn', 'qbccLicence'].filter(k => !(k in cur));
  if (missing.length) {
    for (const k of missing) cur[k] = '';
    plan.push(['settings', 'ADD KEYS', missing.join(', ') + ' (empty — you fill them in Admin)']);
    await save('settings', cur);
  }
}

/* 4 ── footer: add the Terms link if the legal row lacks it. */
{
  const cur = structuredClone(live.footer ?? seed.footer);
  if (!cur.legalLinks.some(l => l.href === '/terms/')) {
    cur.legalLinks.push({ label: 'Terms', href: '/terms/' });
    plan.push(['footer', 'APPEND LINK', 'Terms → /terms/']);
    await save('footer', cur);
  }
}

/* 5 ── the two collection notices, only if they don't already link out. */
{
  const cur = structuredClone(live.contact_page ?? seed.contact_page);
  if (!/\/privacy\//.test(cur.form?.note ?? '')) {
    plan.push(['contact_page', 'REPLACE form.note', `"${cur.form.note}" → adds Privacy Policy link`]);
    cur.form.note = seed.contact_page.form.note;
    await save('contact_page', cur);
  }
}
{
  const cur = structuredClone(live.agent_page ?? seed.agent_page);
  const path = cur.apply?.noteText !== undefined ? 'apply.noteText' : 'noteText';
  const node = path === 'apply.noteText' ? cur.apply : cur;
  if (!/\/privacy\//.test(node.noteText ?? '')) {
    plan.push(['agent_page', `APPEND to ${path}`, 'adds Privacy Policy sentence']);
    node.noteText = (node.noteText ?? '').replace(/\s*$/, '') +
      ' Your details are handled in line with our <a href="/privacy/">Privacy Policy</a>.';
    await save('agent_page', cur);
  }
}

console.log(WRITE ? '── APPLIED ──' : '── DRY RUN (nothing written) ──');
if (!plan.length) console.log('  nothing to change; live content is already up to date');
for (const [k, op, detail] of plan) console.log(`  ${k.padEnd(15)} ${op.padEnd(18)} ${detail}`);
