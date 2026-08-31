/**
 * Admin command search (⌘K) — "where do I change this?".
 *
 * One search box over everything editable: every Site Content section and
 * field (including the current live text, so pasting a sentence from the
 * website lands on the exact field that edits it), properties, journal
 * posts, list items, and the admin pages themselves. Selecting a result
 * navigates to the editor for it.
 *
 * The index is assembled lazily on first open: live site_content rows are
 * merged over the bundled seed, then walked with each section's schema so
 * every value knows its section + field label. All queries degrade to the
 * seed/static entries if Supabase is unreachable.
 */
import { supabase, configured, el } from './client.js';
import { contentSchemas } from './schemas.js';
import seed from '../seed-content.json';

const PLACES = [
  ['Dashboard', '/admin/'],
  ['Properties', '/admin/properties/'],
  ['Journal', '/admin/blog/'],
  ['Pages', '/admin/pages/'],
  ['Site Content', '/admin/content/'],
  ['Page Sections', '/admin/sections/'],
  ['Media Library', '/admin/media/'],
  ['Services & More', '/admin/lists/'],
  ['Leads Inbox', '/admin/leads/'],
  ['Settings', '/admin/settings/'],
  ['Help & Guide', '/admin/help/'],
];

/* Flatten a content document against its schema into
   { label: 'Social links → Instagram → URL', text: '…' } rows. */
function walkFields(fields, data, trail, out) {
  for (const f of fields ?? []) {
    const label = trail ? `${trail} → ${f.label}` : f.label;
    const v = data?.[f.key];
    if (f.type === 'object') {
      walkFields(f.fields, v, label, out);
    } else if (f.type === 'items') {
      for (const item of Array.isArray(v) ? v : []) walkFields(f.fields, item, label, out);
    } else if (f.type === 'list') {
      for (const s of Array.isArray(v) ? v : []) out.push({ label, text: String(s) });
    } else if (v != null && v !== '' && typeof v !== 'boolean') {
      out.push({ label, text: String(v) });
    } else {
      out.push({ label, text: '' });
    }
  }
}

const rows = async (q) => (await q).data ?? [];

async function buildIndex() {
  const entries = [];
  const add = (kind, title, snippet, href) =>
    entries.push({ kind, title, snippet, href, hay: `${title} ${snippet}`.toLowerCase() });

  for (const [name, href] of PLACES) add('Go to', name, '', href);

  // Site content — live values merged over seed, walked with the schemas.
  const docs = { ...seed };
  if (configured && supabase) {
    for (const row of await rows(supabase.from('site_content').select('key, data')))
      if (row.data) docs[row.key] = row.data;
  }
  for (const [key, meta] of Object.entries(contentSchemas)) {
    const href = `/admin/content/?key=${key}`;
    add('Content', meta.title, meta.description ?? '', href);
    const fields = [];
    walkFields(meta.schema, docs[key], '', fields);
    for (const f of fields) entries.push({ kind: meta.title, title: f.label, snippet: f.text, href, hay: `${f.label} ${f.text}`.toLowerCase() });
  }

  /* Team-created pages (custom_pages arrives with the site_content rows). */
  for (const p of docs.custom_pages?.pages ?? []) {
    add('Page', p.title || p.slug, `/${p.slug}/`, `/admin/pages/?edit=${encodeURIComponent(p.slug)}`);
  }

  if (configured && supabase) {
    const [props, posts, services] = await Promise.all([
      rows(supabase.from('properties').select('slug, name, headline, suburb')),
      rows(supabase.from('blog_posts').select('slug, title')),
      rows(supabase.from('services').select('*').limit(50)),
    ]);
    for (const p of props) add('Property', p.name ?? p.slug, [p.suburb, p.headline].filter(Boolean).join(' — '), '/admin/properties/');
    for (const p of posts) add('Journal', p.title ?? p.slug, '', '/admin/blog/');
    for (const s of services) {
      const vals = Object.values(s).filter((v) => typeof v === 'string');
      if (vals.length) add('Services & More', vals[0], vals.slice(1).join(' '), '/admin/lists/');
    }
  }
  return entries;
}

function snippetAround(text, term) {
  if (!text) return '';
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text.slice(0, 90);
  const start = Math.max(0, i - 34);
  return (start ? '…' : '') + text.slice(start, i + 66);
}

function search(entries, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return entries.filter((e) => e.kind === 'Go to');
  const scored = [];
  for (const e of entries) {
    if (!terms.every((t) => e.hay.includes(t))) continue;
    const title = e.title.toLowerCase();
    const score = title.startsWith(terms[0]) ? 0 : terms.every((t) => title.includes(t)) ? 1 : 2;
    scored.push([score, e]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, 24).map(([, e]) => e);
}

export function initAdminSearch() {
  const trigger = document.getElementById('adCmdOpen');
  if (!trigger) return;

  let overlay = null;
  let indexPromise = null;
  let results = [];
  let active = 0;

  const close = () => { overlay?.remove(); overlay = null; };

  function go(entry) {
    close();
    location.href = entry.href;
  }

  function renderResults(list, box, query) {
    box.innerHTML = '';
    results = list;
    active = 0;
    if (!list.length) {
      box.appendChild(el('div', { class: 'ad-cmd-none', text: 'Nothing matches — try fewer words.' }));
      return;
    }
    const term = query.toLowerCase().split(/\s+/).filter(Boolean)[0] ?? '';
    list.forEach((entry, i) => {
      box.appendChild(el('button', {
        type: 'button',
        class: 'ad-cmd-row' + (i === 0 ? ' on' : ''),
        onclick: () => go(entry),
        onmousemove: () => setActive(i),
      }, [
        el('span', { class: 'ad-cmd-kind', text: entry.kind }),
        el('span', { class: 'ad-cmd-title', text: entry.title }),
        el('span', { class: 'ad-cmd-snip', text: snippetAround(entry.snippet, term) }),
      ]));
    });
  }

  function setActive(i) {
    if (!overlay) return;
    const rowEls = overlay.querySelectorAll('.ad-cmd-row');
    if (!rowEls.length) return;
    active = Math.max(0, Math.min(i, rowEls.length - 1));
    rowEls.forEach((r, j) => r.classList.toggle('on', j === active));
    rowEls[active].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    if (overlay) return;
    indexPromise ??= buildIndex();

    const input = el('input', {
      class: 'ad-cmd-input', type: 'text',
      placeholder: 'Search anything — a page, a sentence from the website, a property…',
    });
    const box = el('div', { class: 'ad-cmd-list' }, [
      el('div', { class: 'ad-cmd-none', text: 'Loading…' }),
    ]);
    overlay = el('div', { class: 'ad-cmd-overlay', onclick: (e) => { if (e.target === overlay) close(); } }, [
      el('div', { class: 'ad-cmd' }, [input, box]),
    ]);
    document.body.appendChild(overlay);
    input.focus();

    const refresh = async () => {
      const entries = await indexPromise;
      if (!overlay) return;
      renderResults(search(entries, input.value.trim()), box, input.value.trim());
    };
    refresh();
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
      else if (e.key === 'Escape') close();
    });
  }

  trigger.addEventListener('click', open);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && overlay) close();
  });
}
