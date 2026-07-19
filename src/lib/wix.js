/**
 * Build a resized variant of a Wix static media URL.
 * Original URLs look like:
 *   https://static.wixstatic.com/media/<id>/v1/fill/<params>/<filename>
 * `focus` is an optional Wix focal-point param such as "fp_0.5_0.65".
 */
export function wixResize(url, { w, h, focus = '', q = 90 }) {
  const m = url.match(/^(https:\/\/static\.wixstatic\.com\/media\/[^/]+)\/v1\/fill\/[^/]+\/(.+)$/);
  if (!m) return url;
  const fp = focus ? `${focus},` : '';
  return `${m[1]}/v1/fill/w_${w},h_${h},${fp}q_${q},enc_avif,quality_auto/${m[2]}`;
}

/** "1000m²+" or "632m²" for spec rows and cards. */
export function landLabel(land, landOver) {
  return `${land}m²${landOver ? '+' : ''}`;
}

const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** Number as a word for prose ("Four extraordinary residences…"). */
export function countWord(n) {
  return words[n] ?? String(n);
}
