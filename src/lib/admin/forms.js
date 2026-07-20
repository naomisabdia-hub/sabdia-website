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
      const prev = field.type === 'image'
        ? el('img', { class: 'ad-img-prev', src: v || undefined, alt: '' })
        : null;
      if (prev) input.addEventListener('input', () => { prev.src = input.value; });
      const fileInput = el('input', { type: 'file', accept: field.accept || (field.type === 'image' ? 'image/*' : undefined) });
      const label = el('span', { class: 'ad-btn ad-btn-ghost', text: 'Upload' });
      const wrap = el('label', { class: 'ad-upload' }, [label, fileInput]);
      fileInput.addEventListener('change', async () => {
        const f = fileInput.files[0];
        if (!f) return;
        label.textContent = 'Uploading…';
        try {
          input.value = await uploadFile(f, field.folder || 'uploads');
          if (prev) prev.src = input.value;
          markDirty(container);
          toast('Uploaded');
        } catch (e) {
          toast(e.message || 'Upload failed', true);
        }
        label.textContent = 'Upload';
      });
      const ctl = el('div', { class: 'ad-img-ctl' }, [input, wrap]);
      return el('div', { class: 'ad-img-field' }, [prev, ctl]);
    }
    default:
      return el('input', { class: 'ad-fi', type: 'text', 'data-k': field.key, value: v });
  }
}

function renderField(field, value, container) {
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
