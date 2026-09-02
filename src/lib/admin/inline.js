/**
 * Edit on page — click anything on the live site to change it in place.
 *
 * Loaded only for signed-in staff (dynamic import behind the
 * `sabdia:staff` flag, so public visitors never download it). It builds
 * an index of every editable string and image (site_content merged over
 * the seed, plus the properties table), then matches whatever is
 * clicked back to the exact stored field:
 *
 *   · click an image  → swap it (upload / library / URL)
 *   · click text      → edit the raw value (HTML emphasis preserved)
 *
 * Saves go through the same channels as the admin portal — including a
 * version-history snapshot — and the page updates in place, no reload.
 * Text that can't be matched (composed at render time, e.g. "{name}"
 * templates) gets a graceful hand-off to the admin search instead.
 */
import { supabase, el, toast, uploadFile } from './client.js';
import { openImageLibrary } from './library.js';
import seed from '../seed-content.json';

let active = false;
let docs = {};        // merged content documents by key
let propRows = [];    // properties table rows
let textMap = new Map();  // norm(text) -> refs[]
let imgMap = new Map();   // filename -> refs[]
let ui = {};

const SKIP_KEYS = new Set(['walkthroughs', 'custom_sections', 'page_layout', 'seo_pages']);

const strip = (s) => {
  const d = document.createElement('div');
  d.innerHTML = s;
  return d.textContent || '';
};
const norm = (s) => strip(String(s)).replace(/\s+/g, ' ').trim().toLowerCase();
const human = (s) => String(s).replace(/[_-]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const isImagePath = (v) =>
  typeof v === 'string' && (/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(v) || v.includes('/storage/v1/object/public/'));
const fileKey = (v) => {
  try {
    let path = v;
    if (v.includes('/api/img')) path = new URL(v, location.origin).searchParams.get('src') || v;
    return decodeURIComponent(path).split('?')[0].split('/').pop().toLowerCase();
  } catch { return v; }
};

function addRef(map, key, ref) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(ref);
}

function walk(value, path, register) {
  if (typeof value === 'string') { register(value, path); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => walk(v, [...path, i + 1], register)); return; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, [...path, k], register);
  }
}

async function buildIndex() {
  docs = {};
  for (const [k, v] of Object.entries(seed)) docs[k] = structuredClone(v);
  const { data: rows } = await supabase.from('site_content').select('key, data').not('key', 'like', '\\_%');
  for (const r of rows ?? []) docs[r.key] = r.data;
  const { data: props } = await supabase.from('properties').select('*');
  propRows = props ?? [];

  textMap = new Map();
  imgMap = new Map();
  for (const [key, doc] of Object.entries(docs)) {
    if (SKIP_KEYS.has(key)) continue;
    walk(doc, [], (v, path) => {
      const label = `${human(key)} › ${path.map(human).join(' › ')}`;
      const ref = { kind: 'content', key, path, value: v, label };
      if (isImagePath(v)) addRef(imgMap, fileKey(v), ref);
      else if (norm(v).length >= 3) addRef(textMap, norm(v), ref);
    });
  }
  for (const row of propRows) {
    for (const col of ['name', 'suburb', 'headline', 'enquiry_heading', 'enquiry_text', 'enquiry_button']) {
      const v = row[col];
      if (v && norm(v).length >= 3) addRef(textMap, norm(v), {
        kind: 'property', rowId: row.id, col, value: v, label: `${row.name} › ${human(col)}`,
      });
    }
    if (row.image) addRef(imgMap, fileKey(row.image), {
      kind: 'property', rowId: row.id, col: 'image', value: row.image, label: `${row.name} › Hero image`,
    });
    (row.gallery ?? []).forEach((g, i) => {
      if (g?.src) addRef(imgMap, fileKey(g.src), {
        kind: 'property', rowId: row.id, col: 'gallery', galleryIndex: i, value: g.src,
        label: `${row.name} › Gallery photo ${i + 1}`,
      });
    });
  }
}

/* ── saving ─────────────────────────────────────────────────── */

const setPath = (obj, path, value) => {
  let node = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = typeof path[i] === 'number' ? path[i] - 1 : path[i];
    node = node[k];
  }
  const last = path[path.length - 1];
  node[typeof last === 'number' ? last - 1 : last] = value;
};

async function persist(ref, newValue) {
  if (ref.kind === 'content') {
    const doc = structuredClone(docs[ref.key]);
    setPath(doc, ref.path, newValue);
    await supabase.from('site_content').upsert({
      key: `_history:${ref.key}:${new Date().toISOString()}`,
      data: { data: docs[ref.key], saved_at: new Date().toISOString(), by: 'edit on page' },
    });
    const { error } = await supabase.from('site_content').upsert({ key: ref.key, data: doc });
    if (error) throw error;
    docs[ref.key] = doc;
  } else {
    const row = propRows.find((r) => r.id === ref.rowId);
    let patch;
    if (ref.col === 'gallery') {
      const gallery = structuredClone(row.gallery ?? []);
      gallery[ref.galleryIndex] = { ...gallery[ref.galleryIndex], src: newValue };
      patch = { gallery };
      row.gallery = gallery;
    } else {
      patch = { [ref.col]: newValue };
      row[ref.col] = newValue;
    }
    const { error } = await supabase.from('properties').update(patch).eq('id', ref.rowId);
    if (error) throw error;
  }
}

function applyTextToPage(oldValue, newValue) {
  const target = norm(oldValue);
  const els = [...document.querySelectorAll('#main *, footer *, nav *')]
    .filter((n) => n.children.length <= 3 && norm(n.textContent) === target);
  for (const n of els) n.innerHTML = newValue;
}

function applyImageToPage(oldValue, newValue) {
  const oldKey = fileKey(oldValue);
  for (const img of document.querySelectorAll('img')) {
    if (fileKey(img.src) !== oldKey) continue;
    try {
      const u = new URL(img.src, location.origin);
      if (u.pathname === '/api/img') {
        u.searchParams.set('src', newValue);
        img.src = u.pathname + '?' + u.searchParams.toString();
      } else {
        img.src = newValue.startsWith('/') ? newValue : newValue;
      }
      img.srcset = '';
    } catch { img.src = newValue; }
  }
}

/* ── popover ────────────────────────────────────────────────── */

function closePopover() {
  ui.pop?.remove();
  ui.pop = null;
}

function popoverShell(x, y, title) {
  closePopover();
  const pop = el('div', { class: 'sbx-pop' }, [
    el('div', { class: 'sbx-pop-t' }, [
      el('span', { text: title }),
      el('button', { type: 'button', class: 'sbx-x', text: '✕', onclick: closePopover }),
    ]),
  ]);
  document.body.appendChild(pop);
  const w = Math.min(420, innerWidth - 24);
  pop.style.width = w + 'px';
  pop.style.left = Math.max(12, Math.min(x - w / 2, innerWidth - w - 12)) + 'px';
  pop.style.top = Math.min(y + 14, innerHeight - 80) + 'px';
  return pop;
}

function chooseRef(refs, x, y, then) {
  if (refs.length === 1) return then(refs[0]);
  const pop = popoverShell(x, y, 'This appears in more than one place — which one?');
  for (const ref of refs) {
    pop.appendChild(el('button', { type: 'button', class: 'sbx-opt', text: ref.label, onclick: () => then(ref, true) }));
  }
}

function editText(ref, x, y) {
  const pop = popoverShell(x, y, ref.label);
  const ta = el('textarea', { class: 'sbx-ta' });
  ta.value = ref.value;
  ta.rows = Math.min(10, Math.max(2, Math.ceil(ref.value.length / 60)));
  pop.appendChild(ta);
  if (/<[a-z]/i.test(ref.value)) pop.appendChild(el('div', { class: 'sbx-hint', text: '<em>…</em> renders as the gold italic.' }));
  pop.appendChild(el('div', { class: 'sbx-row' }, [
    el('button', { type: 'button', class: 'sbx-btn sbx-gold', text: 'Save', onclick: async (e) => {
      e.target.disabled = true;
      try {
        const newValue = ta.value;
        await persist(ref, newValue);
        applyTextToPage(ref.value, newValue);
        reindexAfter(ref, newValue);
        toast('Saved — live on the website now');
        closePopover();
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    } }),
    el('button', { type: 'button', class: 'sbx-btn', text: 'Cancel', onclick: closePopover }),
  ]));
  ta.focus();
}

function editImage(ref, x, y) {
  const pop = popoverShell(x, y, ref.label);
  const prev = el('img', { class: 'sbx-prev', src: ref.value.startsWith('/') ? `/api/img?src=${encodeURIComponent(ref.value)}&w=400&h=250` : ref.value });
  pop.appendChild(prev);
  const url = el('input', { class: 'sbx-in', value: ref.value, placeholder: 'Image URL or /images/… path' });
  const save = async (newValue, btn) => {
    if (btn) btn.disabled = true;
    try {
      await persist(ref, newValue);
      applyImageToPage(ref.value, newValue);
      reindexAfter(ref, newValue);
      toast('Image swapped — live on the website now');
      closePopover();
    } catch (err) { toast(err.message, true); if (btn) btn.disabled = false; }
  };
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    toast('Uploading…');
    try { save(await uploadFile(f, 'uploads')); } catch (e) { toast(e.message, true); }
  });
  pop.appendChild(fileInput);
  pop.appendChild(el('div', { class: 'sbx-row' }, [
    el('button', { type: 'button', class: 'sbx-btn sbx-gold', text: 'Upload new', onclick: () => fileInput.click() }),
    el('button', { type: 'button', class: 'sbx-btn', text: 'Library', onclick: () => openImageLibrary((picked) => save(picked)) }),
  ]));
  pop.appendChild(url);
  pop.appendChild(el('div', { class: 'sbx-row' }, [
    el('button', { type: 'button', class: 'sbx-btn sbx-gold', text: 'Save', onclick: (e) => save(url.value.trim(), e.target) }),
    el('button', { type: 'button', class: 'sbx-btn', text: 'Cancel', onclick: closePopover }),
  ]));
}

function reindexAfter(ref, newValue) {
  const map = isImagePath(ref.value) || isImagePath(newValue) ? imgMap : textMap;
  const oldKey = map === imgMap ? fileKey(ref.value) : norm(ref.value);
  const list = (map.get(oldKey) ?? []).filter((r) => r !== ref);
  if (list.length) map.set(oldKey, list); else map.delete(oldKey);
  ref.value = newValue;
  addRef(map, map === imgMap ? fileKey(newValue) : norm(newValue), ref);
}

/* ── event wiring ───────────────────────────────────────────── */

function resolveTextTarget(start) {
  let node = start;
  for (let hop = 0; node && hop < 6 && node !== document.body; hop++, node = node.parentElement) {
    if (['SCRIPT', 'STYLE'].includes(node.tagName)) continue;
    const t = norm(node.textContent || '');
    if (t.length >= 3 && t.length <= 800 && textMap.has(t)) return { refs: textMap.get(t), el: node };
  }
  return null;
}

function onClick(e) {
  if (ui.pop && ui.pop.contains(e.target)) return; // let the popover work
  e.preventDefault();
  e.stopPropagation();
  const x = e.clientX, y = e.clientY;
  if (e.target.tagName === 'IMG') {
    const refs = imgMap.get(fileKey(e.target.src));
    if (refs?.length) return chooseRef(refs, x, y, (ref) => editImage(ref, x, y));
  }
  const hit = resolveTextTarget(e.target);
  if (hit) return chooseRef(hit.refs, x, y, (ref) => editText(ref, x, y));
  const pop = popoverShell(x, y, "Couldn't pin this one down");
  pop.appendChild(el('div', { class: 'sbx-hint', text: 'This piece is assembled at render time (or lives in the Journal/property description). Find it by searching a few of its words in the admin:' }));
  pop.appendChild(el('a', { class: 'sbx-btn sbx-gold', text: 'Open admin search', href: '/admin/content/', target: '_blank', style: 'display:inline-block;text-decoration:none;margin-top:8px' }));
}

function onMove(e) {
  if (!ui.hl) return;
  let box = null;
  if (e.target.tagName === 'IMG' && imgMap.has(fileKey(e.target.src))) box = e.target;
  else box = resolveTextTarget(e.target)?.el ?? null;
  if (!box || (ui.pop && ui.pop.contains(e.target))) { ui.hl.style.display = 'none'; return; }
  const r = box.getBoundingClientRect();
  Object.assign(ui.hl.style, {
    display: 'block', left: r.left - 3 + 'px', top: r.top - 3 + 'px',
    width: r.width + 6 + 'px', height: r.height + 6 + 'px',
  });
}

function onKey(e) {
  if (e.key === 'Escape') (ui.pop ? closePopover() : toggleInlineEdit());
}

const CSS = `
#sbInlinePill.on{background:var(--gold);color:#1F1B14;opacity:1}
.sbx-hl{position:fixed;z-index:6900;pointer-events:none;border:1.5px solid #C3A45E;background:rgba(195,164,94,.08);transition:all .06s linear;display:none}
.sbx-pop{position:fixed;z-index:7000;background:#FDFBF6;color:#292319;border:1px solid #C3A45E;box-shadow:0 18px 50px rgba(31,27,20,.35);padding:14px 16px;font-family:'Jost',system-ui,sans-serif;font-size:13px;display:flex;flex-direction:column;gap:10px}
.sbx-pop-t{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8F7238}
.sbx-x{background:none;border:none;cursor:pointer;font-size:13px;color:#6B6455}
.sbx-ta{width:100%;min-height:60px;font-family:inherit;font-size:13.5px;line-height:1.6;padding:10px;border:1px solid #E2DACB;background:#fff;box-sizing:border-box}
.sbx-in{width:100%;font-family:inherit;font-size:12px;padding:8px 10px;border:1px solid #E2DACB;background:#fff;box-sizing:border-box}
.sbx-row{display:flex;gap:8px;flex-wrap:wrap}
.sbx-btn{cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:.16em;text-transform:uppercase;padding:9px 14px;border:1px solid #C3A45E;background:transparent;color:#292319}
.sbx-gold{background:#A8874A;border-color:#A8874A;color:#fff}
.sbx-opt{cursor:pointer;text-align:left;font-family:inherit;font-size:12.5px;padding:9px 10px;border:1px solid #E2DACB;background:#fff;color:#292319}
.sbx-opt:hover{border-color:#C3A45E}
.sbx-prev{max-width:100%;max-height:180px;object-fit:contain;background:#F1EBDF}
.sbx-hint{font-size:12px;color:#6B6455;line-height:1.55}
`;

export async function toggleInlineEdit() {
  const pill = document.getElementById('sbInlinePill');
  if (active) {
    active = false;
    closePopover();
    ui.hl?.remove();
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('keydown', onKey, true);
    pill?.classList.remove('on');
    if (pill) pill.textContent = '⚡ Edit on page';
    return;
  }
  if (!ui.css) {
    ui.css = el('style', { text: CSS });
    document.head.appendChild(ui.css);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/admin.css'; // styles the image-library modal
    document.head.appendChild(link);
  }
  if (pill) pill.textContent = 'Indexing…';
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      toast('You can browse in edit mode, but saving needs a sign-in — open /admin once in this browser.', true);
    }
    await buildIndex();
  } catch (e) {
    toast(e.message || 'Could not load the content index', true);
    if (pill) pill.textContent = '⚡ Edit on page';
    return;
  }
  active = true;
  ui.hl = el('div', { class: 'sbx-hl' });
  document.body.appendChild(ui.hl);
  document.addEventListener('click', onClick, true);
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('keydown', onKey, true);
  pill?.classList.add('on');
  if (pill) pill.textContent = '✓ Editing — click anything · Esc to finish';
  toast('Edit mode on — click any text or image');
}
