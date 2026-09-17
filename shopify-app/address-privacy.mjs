/**
 * Take street addresses out of any text the website shows (Naomi, 17 Sep
 * 2026: never show the address, suburb only; Instagram may keep its own).
 * A line-for-line port of address_privacy.py; both read address-privacy.json.
 *
 *   import { redact } from './address-privacy.mjs';
 *   redact('Meet Sierra. 📍 6 Dagmar Street, Holland Park West');
 *   // -> 'Meet Sierra. 📍 Holland Park West'
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'address-privacy.json'), 'utf8'));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const either = (w) => `[${w[0].toUpperCase()}${w[0].toLowerCase()}]${esc(w.slice(1))}`;
const TYPES = '(?:' + [...DATA.types].sort((a, b) => b.length - a.length).flatMap((t) => [either(t), esc(t.toUpperCase())]).join('|') + ')\\b';
const COLL = '(?:[Cc]ollection|COLLECTION)';
const NUM = '(\\d+[A-Za-z]?)\\s+';
// Capitalise the replacement only where the original started a sentence.
const cap = (src, word, offset, whole) => {
  const before = whole.slice(0, offset).trimEnd();
  const last = before.slice(-1);
  const starts = !before || /[.!?]/.test(last) || (!/[\p{L}\p{N}]/u.test(last) && !/[,;:]/.test(last));
  return /^[A-Z]/.test(src) && starts ? word[0].toUpperCase() + word.slice(1) : word;
};

function street(text, st) {
  const words = st.name.split(/\s+/);
  const name = '(?:' + words.map(esc).join('\\s+') + '|' + words.map((w) => esc(w.toUpperCase())).join('\\s+') + ')';
  const sub = esc(st.suburb);
  const houses = st.houses;
  const vals = Object.values(houses);
  const sole = vals.length === 1 ? vals[0] : null;
  text = text.replace(new RegExp(`\\b(?:[Tt]he|[Oo]ur)\\s+${name}\\s+${TYPES}\\s+${COLL}`, 'g'), (m, offset, whole) => cap(m, `our ${st.suburb} collection`, offset, whole));
  text = text.replace(new RegExp(`\\b${name}\\s+${TYPES}\\s+${COLL}`, 'g'), () => `${st.suburb} collection`);
  text = text.replace(new RegExp(`\\b([Oo]n|[Aa]t)\\s+the\\s+corner\\s+of\\s+(?:${NUM})?${name}\\s+${TYPES}(?:,?\\s+(?:in\\s+)?${sub}\\b)?`, 'g'),
    (m, p, num, offset, whole) => cap(p, `on a corner in ${st.suburb}`, offset, whole));
  text = text.replace(new RegExp(`\\b([Oo]n|[Aa]long|[Aa]t)\\s+(?:${NUM})?${name}\\s+${TYPES}(?:,?\\s+(?:in\\s+)?${sub}\\b)?`, 'g'),
    (m, p, num, offset, whole) => cap(p, `in ${st.suburb}`, offset, whole));
  const src = text;
  text = text.replace(new RegExp(`${NUM}${name}\\s+${TYPES}(,?\\s+${sub}\\b)?`, 'g'), (m, num, withSuburb, offset) => {
    let house = houses[num] || houses[num.toUpperCase()] || null;
    if (house && src.slice(Math.max(0, offset - 30), offset).toLowerCase().includes(house.toLowerCase())) house = null;
    if (withSuburb) return house ? `${house}, ${st.suburb}` : st.suburb;
    return house || st.suburb;
  });
  text = text.replace(new RegExp(`\\b${name}\\s+${TYPES}`, 'g'), () => sole || st.suburb);
  return text;
}

const UNKNOWN = new RegExp(`\\b\\d+[A-Za-z]?(?:[-/]\\d+)?\\s+(?:[A-Z][a-z]+\\s+){1,3}${TYPES},?\\s*`, 'g');

/** Text without street addresses; `unknown` (an array) collects streets not in address-privacy.json (removed too). */
export function redact(text, unknown) {
  if (!text || typeof text !== 'string') return text;
  for (const st of DATA.streets) text = street(text, st);
  return text.replace(UNKNOWN, (m) => { if (unknown) unknown.push(m.trim()); return ''; });
}

/** redact() every string inside a JSON value. */
export function redactJson(value, unknown) {
  if (typeof value === 'string') return redact(value, unknown);
  if (Array.isArray(value)) return value.map((v) => redactJson(v, unknown));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactJson(v, unknown)]));
  return value;
}
