/**
 * Site content data layer (everything that isn't a property).
 *
 * Content lives in three Supabase tables — `site_content` (one jsonb document
 * per section, keyed), `services`, `process_steps`, `testimonials` — and is
 * editable from the admin portal. Like db.js, every read falls back to the
 * bundled seed (src/lib/seed-content.json) when Supabase is unconfigured or
 * unreachable, so the site always renders.
 */
import { createClient } from '@supabase/supabase-js';
import seed from './seed-content.json';

const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const supabase = url && anonKey ? createClient(url, anonKey) : null;

/**
 * Fetch site_content documents for the given keys.
 * Returns { key: data } with seed fallback per missing key.
 */
export async function getContent(...keys) {
  const out = {};
  for (const k of keys) out[k] = seed[k];
  if (!supabase) return out;
  const { data, error } = await supabase
    .from('site_content')
    .select('key, data')
    .in('key', keys);
  if (error) {
    console.error('Supabase site_content query failed, using seed data:', error.message);
    return out;
  }
  for (const row of data ?? []) if (row.data) out[row.key] = row.data;
  return out;
}

async function fetchList(table, seedKey) {
  if (!supabase) return seed[seedKey];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('sort', { ascending: true });
  if (error || !data || data.length === 0) {
    if (error) console.error(`Supabase ${table} query failed, using seed data:`, error.message);
    return seed[seedKey];
  }
  return data;
}

/** All services, sorted. */
export function getServices() {
  return fetchList('services', 'services');
}

/** All process steps, sorted. */
export function getProcessSteps() {
  return fetchList('process_steps', 'process_steps');
}

/** All testimonials, sorted. */
export function getTestimonials() {
  return fetchList('testimonials', 'testimonials');
}
