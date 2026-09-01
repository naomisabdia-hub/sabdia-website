/**
 * Schema-driven form engine for the admin portal.
 *
 * A schema is an array of field specs:
 *   { key, label, type, help?, required?, options?, fields?, item? }
 * Types: text, textarea, html, number, checkbox, select, image, file,
 *        list (of strings), items (list of objects, `fields` describes each),
 *        object (nested group, `fields` describes children).
 *
 * buildForm(container, schema, data) renders inputs pre-filled from `data`;
 * readForm(container, schema, base) collects values back into an object.
 * Fields not present in the schema are preserved from the base object, so
 * partial forms never destroy unknown keys.
 */
import { el, uploadFile, toast } from './client.js';
import { openImageLibrary } from './library.js';

const get = (obj, key) => (obj == null ? undefined : obj[key]);

function markDirty(container) {
  container.dispatchEvent(new CustomEvent('ad-dirty', { bubbles: true }));
}

/* Formatting toolbar for long-text fields. Buttons insert the site's own
   markup — markdown-lite on textareas (what the Journal renderer reads),
   HTML emphasis on 'html' fields — so every emphasis option an editor has
   stays inside the design system. */
const TOOLBARS = {
  textarea: [
    ['B', 'Bold', '**', '**'],
    ['I', 'Italic', '*', '*'],
    ['H2', 'Section heading', '\n\n## ', ''],
    ['H3', 'Small heading', '\n\n### ', ''],
    ['“”', 'Pull quote', '\n\n> ', ''],
    ['•', 'Bullet list', '\n\n- ', ''],
    ['Link', 'Link — select text first', '[', '](/contact/)'],
  ],
  html: [
    ['I gold', 'Gold italic emphasis', '<em>', '</em>'],
    ['↵', 'Line break', '<br>', ''],
  ],
};

function wrapSelection(ta, before, after) {
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const sel = ta.value.slice(start, end);
  ta.value = ta.value.slice(0, start) + before + sel + after + ta.value.slice(end);
  ta.focus();
  const pos = start + before.length + sel.length;
  ta.setSelectionRange(sel ? pos + after.length : start + before.length, sel ? pos + after.length : start + before.length + 0);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function withToolbar(field, ta) {
  const spec = TOOLBARS[field.type];
  if (!spec || field.plain) return ta;
  const bar = el('div', { class: 'ad-fmtbar' },
    spec.map(([label, title, before, after]) =>
      el('button', { type: 'button', class: 'ad-fmtbtn', title, text: label,
        onclick: () => wrapSelection(ta, before, after) })));
  return el('div', { class: 'ad-fta-wrap' }, [bar, ta]);
}

function inputFor(field, value, container) {
  const v = value ?? '';
  switch (field.type) {
    case 'textarea':
    case 'html':
      return withToolbar(field, el('textarea', { class: 'ad-fta', 'data-k': field.key, text: v }));
    case 'number':
      return el('input', { class: 'ad-fi', type: 'number', 'data-k': field.key, value: v });
    case 'checkbox': {
      const box = el('input', { type: 'checkbox', 'data-k': field.key });
      box.checked = Boolean(value);
      return el('label', { class: 'ad-check' }, [box, el('span', { text: field.checkLabel || 'Yes' })]);
    }
    case 'select': {
      const sel = el('select', { class: 'ad-fsel', 'data-k': field.key });
      for (const opt of field.options) {
        const [val, label] = Array.isArray(opt) ? opt : [opt, opt];
        const o = el('option', { value: val, text: label });
        if (String(val) === String(v)) o.selected = true;
        sel.appendChild(o);
      }
      return sel;
    }
    case 'image':
    case 'file': {
      const input = el('input', { class: 'ad-fi', type: 'url', 'data-k': field.key, value: v, placeholder: 'https://… or upload →' });
      const imgEl = field.type === 'image'
        ? el('img', { class: 'ad-img-prev', src: v || undefined, alt: '' })
        : null;
      let prev = imgEl;
      if (imgEl) input.addEventListener('input', () => { imgEl.src = input.value; });
      /* Focal point picker: clicking the preview stores fp_x_y in the
         sibling field named by focusKey — the image pipeline centres
         every crop on that spot. */
      if (imgEl && field.focusKey) {
        const dot = el('span', { style: 'position:absolute;width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:rgba(168,135,74,.85);transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.35);display:none' });
        const wrapPrev = el('div', { style: 'position:relative;display:inline-block;cursor:crosshair', title: 'Click to set the focal point' }, [imgEl, dot]);
        const placeDot = (fp) => {
          const m = /^fp_([\d.]+)_([\d.]+)$/.exec(fp || '');
          if (!m) { dot.style.display = 'none'; return; }
          dot.style.display = '';
          dot.style.left = m[1] * 100 + '%';
          dot.style.top = m[2] * 100 + '%';
        };
        wrapPrev.addEventListener('click', (e) => {
          const r = imgEl.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)).toFixed(2);
          const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)).toFixed(2);
          const target = container.querySelector(`[data-k="${field.focusKey}"]`);
          if (target) { target.value = `fp_${x}_${y}`; markDirty(container); }
          placeDot(`fp_${x}_${y}`);
        });
        queueMicrotask(() => placeDot(container.querySelector(`[data-k="${field.focusKey}"]`)?.value));
        prev = wrapPrev;
      }
      const fileInput = el('input', { type: 'file', accept: field.accept || (field.type === 'image' ? 'image/*' : undefined) });
      const label = el('span', { class: 'ad-btn ad-btn-ghost', text: 'Upload' });
      const wrap = el('label', { class: 'ad-upload' }, [label, fileInput]);
      fileInput.addEventListener('change', async () => {
        const f = fileInput.files[0];
        if (!f) return;
        label.textContent = 'Uploading…';
        try {
          input.value = await uploadFile(f, field.folder || 'uploads');
          if (imgEl) imgEl.src = input.value;
          markDirty(container);
          toast('Uploaded');
        } catch (e) {
          toast(e.message || 'Upload failed', true);
        }
        label.textContent = 'Upload';
      });
      /* Image fields also offer the shared library — reuse anything
         already uploaded or bundled, without re-uploading. */
      const libBtn = field.type === 'image'
        ? el('button', { type: 'button', class: 'ad-btn ad-btn-ghost', text: 'Library', onclick: () =>
            openImageLibrary((url) => {
              input.value = url;
              if (imgEl) imgEl.src = url;
              markDirty(container);
            }) })
        : null;
      const ctl = el('div', { class: 'ad-img-ctl' }, [input, wrap, libBtn].filter(Boolean));
      return el('div', { class: 'ad-img-field' }, [prev, ctl]);
    }
    default:
      return el('input', { class: 'ad-fi', type: 'text', 'data-k': field.key, value: v });
  }
}

function renderField(field, value, container) {
  /* 'bands' — a page's sections as a fixed list: reorder with ↑↓ and
     show/hide with the checkbox. Value shape merges into the page's
     layout object: { order: ['stats', …], stats: true, … }. Pages whose
     band positions are structural set `fixed: true` (toggles only). */
  if (field.type === 'bands') {
    const wrap = el('div', { class: 'ad-group', 'data-bands': field.key }, [
      el('div', { class: 'ad-group-h', text: field.label }),
    ]);
    if (field.help) wrap.appendChild(el('p', { class: 'ad-sub', text: field.help, style: 'margin:0 0 10px' }));
    const listBox = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const saved = Array.isArray(value?.order) ? value.order : [];
    const keys = [
      ...saved.filter((k) => field.bands.some((b) => b.key === k)),
      ...field.bands.map((b) => b.key).filter((k) => !saved.includes(k)),
    ];
    for (const key of keys) {
      const band = field.bands.find((b) => b.key === key);
      const box = el('input', { type: 'checkbox', 'data-band': key, title: 'Show this band' });
      box.checked = value?.[key] !== false;
      const row = el('div', { class: 'ad-item', 'data-band-row': key, style: 'display:flex;align-items:center;gap:10px;padding:9px 12px' }, [
        ...(field.fixed ? [] : [
          el('button', { type: 'button', text: '↑', title: 'Move up', onclick: (e) => { const r = e.target.closest('[data-band-row]'); const p = r.previousElementSibling; if (p) listBox.insertBefore(r, p); markDirty(container); } }),
          el('button', { type: 'button', text: '↓', title: 'Move down', onclick: (e) => { const r = e.target.closest('[data-band-row]'); const n = r.nextElementSibling; if (n) listBox.insertBefore(n, r); markDirty(container); } }),
        ]),
        el('label', { class: 'ad-check', style: 'margin-left:auto;order:2' }, [box, el('span', { text: 'Show' })]),
        el('span', { text: band.label, style: 'font-weight:400' }),
      ]);
      listBox.appendChild(row);
    }
    wrap.appendChild(listBox);
    return wrap;
  }

  if (field.type === 'object') {
    const group = el('div', { class: 'ad-group', 'data-obj': field.key }, [
      el('div', { class: 'ad-group-h', text: field.label }),
    ]);
    for (const child of field.fields) group.appendChild(renderField(child, get(value, child.key), container));
    return group;
  }

  if (field.type === 'list' || field.type === 'items') {
    const isObj = field.type === 'items';
    const wrap = el('div', { class: 'ad-group', 'data-list': field.key, 'data-list-type': field.type }, [
      el('div', { class: 'ad-group-h', text: field.label }),
    ]);
    const itemsBox = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    wrap.appendChild(itemsBox);

    const addItem = (itemValue) => {
      const item = el('div', { class: 'ad-item', 'data-item': '' });
      const bar = el('div', { class: 'ad-item-bar' }, [
        el('button', { type: 'button', text: '↑', title: 'Move up', onclick: () => { const p = item.previousElementSibling; if (p) itemsBox.insertBefore(item, p); markDirty(container); } }),
        el('button', { type: 'button', text: '↓', title: 'Move down', onclick: () => { const n = item.nextElementSibling; if (n) itemsBox.insertBefore(n, item); markDirty(container); } }),
        el('button', { type: 'button', text: 'Remove', onclick: () => { if (confirm('Remove this item?')) { item.remove(); markDirty(container); } } }),
      ]);
      item.appendChild(bar);
      if (isObj) {
        for (const child of field.fields) item.appendChild(renderField(child, get(itemValue, child.key), container));
      } else {
        item.appendChild(inputFor({ key: '__v', type: field.itemType || 'text' }, itemValue, container));
      }
      itemsBox.appendChild(item);
    };
    for (const itemValue of Array.isArray(value) ? value : []) addItem(itemValue);
    wrap.appendChild(el('button', { type: 'button', class: 'ad-add', text: `+ Add ${field.itemLabel || 'item'}`, onclick: () => { addItem(isObj ? {} : ''); markDirty(container); } }));
    return wrap;
  }

  const fg = el('div', { class: 'ad-fg' });
  const label = el('label', { class: 'ad-fl', text: field.label });
  if (field.help) label.appendChild(el('small', { text: ' — ' + field.help }));
  fg.appendChild(label);
  fg.appendChild(inputFor(field, value, container));
  return fg;
}

export function buildForm(container, schema, data) {
  container.innerHTML = '';
  for (const field of schema) container.appendChild(renderField(field, get(data, field.key), container));
  container.addEventListener('input', () => markDirty(container));
  container.addEventListener('change', () => markDirty(container));
}

function readScope(scope, fields) {
  const out = {};
  for (const field of fields) out[field.key] = readValue(scope, field);
  return out;
}

function directChild(scope, selector, key) {
  // find the element for `key` that belongs to this scope, not a nested list/object
  const all = scope.querySelectorAll(selector);
  for (const node of all) {
    let p = node.parentElement;
    while (p && p !== scope) {
      if (p.hasAttribute('data-list') || p.hasAttribute('data-obj') || p.hasAttribute('data-item')) break;
      p = p.parentElement;
    }
    if (p === scope || (p && !p.hasAttribute('data-list') && !p.hasAttribute('data-obj') && !p.hasAttribute('data-item'))) return node;
  }
  return null;
}

function readValue(scope, field) {
  if (field.type === 'bands') {
    const wrap = scope.querySelector(`[data-bands="${field.key}"]`);
    if (!wrap) return undefined;
    const out = { order: [] };
    for (const row of wrap.querySelectorAll('[data-band-row]')) {
      const key = row.getAttribute('data-band-row');
      out.order.push(key);
      out[key] = row.querySelector('[data-band]').checked;
    }
    return out;
  }
  if (field.type === 'object') {
    const group = scope.querySelector(`[data-obj="${field.key}"]`);
    return group ? readScope(group, field.fields) : undefined;
  }
  if (field.type === 'list' || field.type === 'items') {
    const wrap = scope.querySelector(`[data-list="${field.key}"]`);
    if (!wrap) return [];
    return [...wrap.querySelectorAll(':scope > div > [data-item]')].map((item) =>
      field.type === 'items'
        ? readScope(item, field.fields)
        : item.querySelector('[data-k="__v"]').value.trim(),
    ).filter((v) => (typeof v === 'string' ? v !== '' : true));
  }
  const node = directChild(scope, `[data-k="${field.key}"]`, field.key);
  if (!node) return undefined;
  if (field.type === 'checkbox') return node.checked;
  if (field.type === 'number') return node.value === '' ? null : Number(node.value);
  return node.value;
}

export function readForm(container, schema, base = {}) {
  const out = { ...base };
  for (const field of schema) {
    const v = readValue(container, field);
    if (v !== undefined) out[field.key] = v;
  }
  return out;
}

/** Wire a sticky save bar: tracks dirty state, runs `onSave`, warns on leave. */
export function saveBar(container, bar, onSave) {
  let dirty = false;
  container.addEventListener('ad-dirty', () => { dirty = true; bar.classList.add('dirty'); });
  window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
  bar.querySelector('[data-save]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await onSave();
      dirty = false;
      bar.classList.remove('dirty');
      toast('Saved — live on the website now');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Save failed', true);
    }
    btn.disabled = false;
  });
}
