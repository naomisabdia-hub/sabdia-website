/**
 * Property data layer.
 *
 * Reads properties from Supabase when SUPABASE_URL / SUPABASE_ANON_KEY are
 * configured; otherwise (or if the query fails) falls back to the bundled
 * seed data so the site always renders.
 *
 * Entries are returned as { id, data, body } — the same shape the pages
 * used with Astro content collections.
 */
import { createClient } from '@supabase/supabase-js';
import seed from './seed-properties.json';

const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = url && anonKey ? createClient(url, anonKey) : null;

function toEntry(row) {
  return {
    id: row.slug,
    data: {
      name: row.name,
      order: row.display_order,
      status: row.status,
      suburb: row.suburb,
      state: row.state,
      year: row.year,
      beds: row.beds,
      baths: row.baths,
      cars: row.cars,
      land: row.land,
      landOver: row.land_over,
      image: row.image,
      focus: row.focus || '',
      headline: row.headline,
      seoDescription: row.seo_description,
      features: row.features || [],
      gallery: row.gallery || [],
      enquiryHeading: row.enquiry_heading,
      enquiryText: row.enquiry_text,
      enquiryButton: row.enquiry_button || 'Submit Enquiry',
      brochureUrl: row.brochure_url || '',
    },
    body: row.description || '',
  };
}

async function fetchRows() {
  if (!supabase) return seed;
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('display_order', { ascending: true });
  if (error || !data || data.length === 0) {
    if (error) console.error('Supabase properties query failed, using seed data:', error.message);
    return seed;
  }
  return data;
}

/* The CMS often pads a gallery by repeating the hero render with
   different crops, or borrowing another residence's facade. Collapse to
   one entry per underlying Wix asset and drop other properties' hero
   images so every consumer renders a clean set. */
const mediaKey = (src) => src?.match(/\/media\/([^/~]+)/)?.[1] ?? src;

function cleanGalleries(entries) {
  const heroOwner = new Map(entries.map((e) => [mediaKey(e.data.image), e.id]));
  for (const e of entries) {
    const seen = new Set();
    e.data.gallery = (e.data.gallery ?? []).filter((g) => {
      const k = mediaKey(g.src);
      const owner = heroOwner.get(k);
      if (seen.has(k) || (owner && owner !== e.id)) return false;
      seen.add(k);
      return true;
    });
  }
  return entries;
}

/** All properties, sorted by display order. */
export async function getProperties() {
  return cleanGalleries((await fetchRows()).map(toEntry));
}

/** A single property by slug, or null. */
export async function getProperty(slug) {
  const all = await getProperties();
  return all.find((p) => p.id === slug) ?? null;
}
