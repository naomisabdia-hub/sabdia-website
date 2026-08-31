/**
 * Shared media library for the admin portal.
 *
 * listBucketAssets() inventories the Supabase `media` bucket — every
 * upload, film, brochure and poster, EXCLUDING walkthrough frame folders
 * (a single scroll cut holds hundreds of near-identical stills that
 * would drown everything else) and archived masters. siteImages() lists
 * the photography bundled with the site from image-manifest.json.
 *
 * openImageLibrary(onPick) is the pick-an-image modal wired into every
 * image field by forms.js — searchable, with its own Upload button so an
 * editor never has to leave the field to add something new. The
 * full-page manager at /admin/media/ builds on the same listing.
 */
import { supabase, el, toast, uploadFile } from './client.js';
import manifest from '../image-manifest.json';

export const IMG_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;

/* Top-level bucket folders that never belong in the library. */
const SKIP_FOLDERS = new Set(['scrollwalk', 'walkthrough', 'walkthroughs', 'archive']);

export const thumb = (src) => `/api/img?src=${encodeURIComponent(src)}&w=360&h=240&q=70`;

export async function listBucketAssets() {
  const out = [];
  const walk = async (prefix, depth) => {
    const { data, error } = await supabase.storage.from('media').list(prefix, { limit: 400, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) {
        /* Folders come back without an object id (null or absent,
           depending on the client version); files always carry one. */
        if (!prefix && SKIP_FOLDERS.has(entry.name)) continue;
        if (depth < 2) await walk(path, depth + 1);
      } else {
        out.push({
          url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl,
          path,
          name: entry.name,
          folder: prefix || 'media',
          when: entry.created_at ? Date.parse(entry.created_at) : 0,
          size: entry.metadata?.size ?? null,
          kind: IMG_EXT.test(entry.name) ? 'image' : 'file',
        });
      }
    }
  };
  await walk('', 0);
  return out.sort((a, b) => b.when - a.when);
}

export function siteImages() {
  return Object.values(manifest)
    .filter((m) => IMG_EXT.test(m.file))
    .map((m) => ({ url: m.file, path: null, name: m.file.replace('/images/', ''), folder: 'site photography', when: 0, size: null, kind: 'image' }));
}

/** Permanently remove an uploaded object from the media bucket. */
export async function deleteAsset(path) {
  const { error } = await supabase.storage.from('media').remove([path]);
  if (error) throw error;
}

export const fmtSize = (n) =>
  n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;

let overlay = null;

export function openImageLibrary(onPick) {
  if (overlay) overlay.remove();

  const close = () => { overlay.remove(); overlay = null; };
  const grid = el('div', { class: 'ad-lib-grid' }, [
    el('div', { class: 'ad-lib-note', text: 'Loading the library…' }),
  ]);

  let items = [];
  const searchBox = el('input', { class: 'ad-fi', type: 'search', placeholder: 'Search by name or folder…', style: 'flex:1' });

  const fill = () => {
    const q = searchBox.value.trim().toLowerCase();
    const list = q ? items.filter((i) => `${i.name} ${i.folder}`.toLowerCase().includes(q)) : items;
    grid.innerHTML = '';
    if (!list.length) {
      grid.appendChild(el('div', { class: 'ad-lib-note', text: q ? 'Nothing matches — try fewer letters.' : 'No images yet — upload one and it will appear here for reuse.' }));
      return;
    }
    for (const item of list) {
      grid.appendChild(el('button', { type: 'button', class: 'ad-lib-item', title: `${item.folder}/${item.name}`, onclick: () => { onPick(item.url); close(); } }, [
        el('img', { src: thumb(item.url), alt: '', loading: 'lazy' }),
        el('span', { text: item.name }),
      ]));
    }
  };
  searchBox.addEventListener('input', fill);

  /* Upload straight from the picker: the new image lands in the library
     AND is picked for the field in one motion. */
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  const upBtn = el('span', { class: 'ad-btn ad-btn-gold', text: 'Upload new' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    upBtn.textContent = 'Uploading…';
    try {
      const url = await uploadFile(f, 'uploads');
      toast('Uploaded — using it here');
      onPick(url);
      close();
    } catch (e) {
      toast(e.message || 'Upload failed', true);
      upBtn.textContent = 'Upload new';
    }
  });

  overlay = el('div', { class: 'ad-lib-overlay', onclick: (e) => { if (e.target === overlay) close(); } }, [
    el('div', { class: 'ad-lib-modal' }, [
      el('div', { class: 'ad-lib-head' }, [
        el('div', {}, [
          el('div', { class: 'ad-lib-title', text: 'Image library' }),
          el('div', { class: 'ad-lib-sub', text: 'Pick anything already on the site — nothing needs uploading twice.' }),
        ]),
        el('button', { type: 'button', class: 'ad-btn ad-btn-ghost', text: 'Close', onclick: close }),
      ]),
      el('div', { class: 'ad-lib-tools' }, [searchBox, el('label', {}, [upBtn, fileInput])]),
      grid,
    ]),
  ]);
  document.body.appendChild(overlay);
  searchBox.focus();

  listBucketAssets()
    .then((uploads) => { items = [...uploads.filter((u) => u.kind === 'image'), ...siteImages()]; fill(); })
    .catch((e) => {
      console.warn('Bucket listing failed, showing site images only:', e.message);
      toast('Could not list uploads — showing the built-in images only.', true);
      items = siteImages();
      fill();
    });
}
