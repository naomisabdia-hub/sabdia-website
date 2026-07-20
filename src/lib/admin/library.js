/**
 * Shared image library for the admin portal.
 *
 * openImageLibrary(onPick) shows a modal listing every image the site
 * already has — admin uploads in the Supabase `media` bucket plus the
 * bundled masters from image-manifest.json — so an editor can reuse an
 * image anywhere without re-uploading it. Wired into every image field
 * by forms.js (the "Library" button beside "Upload").
 *
 * Bucket listing walks folders two levels deep, which covers the
 * media bucket's layout (uploads/…, hero/…, media/walkthrough/<slug>/…);
 * only image extensions are shown — the bucket also holds films, 3D
 * models and brochures.
 */
import { supabase, el, toast } from './client.js';
import manifest from '../image-manifest.json';

const IMG_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;

const thumb = (src) => `/api/img?src=${encodeURIComponent(src)}&w=360&h=240&q=70`;

async function listBucketImages() {
  const out = [];
  const walk = async (prefix, depth) => {
    const { data, error } = await supabase.storage.from('media').list(prefix, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) {
        /* Folders come back without an object id (null or absent,
           depending on the client version); files always carry one. */
        if (depth < 2) await walk(path, depth + 1);
      } else if (IMG_EXT.test(entry.name)) {
        out.push({
          url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl,
          name: path,
          when: entry.created_at ? Date.parse(entry.created_at) : 0,
        });
      }
    }
  };
  await walk('', 0);
  return out.sort((a, b) => b.when - a.when);
}

function siteImages() {
  return Object.values(manifest)
    .filter((m) => IMG_EXT.test(m.file))
    .map((m) => ({ url: m.file, name: m.file.replace('/images/', '') }));
}

let overlay = null;

export function openImageLibrary(onPick) {
  if (overlay) overlay.remove();

  const close = () => { overlay.remove(); overlay = null; };
  const grid = el('div', { class: 'ad-lib-grid' }, [
    el('div', { class: 'ad-lib-note', text: 'Loading the library…' }),
  ]);

  overlay = el('div', { class: 'ad-lib-overlay', onclick: (e) => { if (e.target === overlay) close(); } }, [
    el('div', { class: 'ad-lib-modal' }, [
      el('div', { class: 'ad-lib-head' }, [
        el('div', {}, [
          el('div', { class: 'ad-lib-title', text: 'Image library' }),
          el('div', { class: 'ad-lib-sub', text: 'Pick an image already on the site — uploads first, then the built-in photography.' }),
        ]),
        el('button', { type: 'button', class: 'ad-btn ad-btn-ghost', text: 'Close', onclick: close }),
      ]),
      grid,
    ]),
  ]);
  document.body.appendChild(overlay);

  const fill = (items) => {
    grid.innerHTML = '';
    if (!items.length) {
      grid.appendChild(el('div', { class: 'ad-lib-note', text: 'No images yet — upload one and it will appear here for reuse.' }));
      return;
    }
    for (const item of items) {
      grid.appendChild(el('button', { type: 'button', class: 'ad-lib-item', title: item.name, onclick: () => { onPick(item.url); close(); } }, [
        el('img', { src: thumb(item.url), alt: '', loading: 'lazy' }),
        el('span', { text: item.name }),
      ]));
    }
  };

  listBucketImages()
    .then((uploads) => fill([...uploads, ...siteImages()]))
    .catch((e) => {
      console.warn('Bucket listing failed, showing site images only:', e.message);
      toast('Could not list uploads — showing the built-in images only.', true);
      fill(siteImages());
    });
}
