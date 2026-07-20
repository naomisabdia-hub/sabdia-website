/**
 * Blog data layer — "The Sabdia Journal".
 *
 * Posts live in Supabase `blog_posts` (see supabase/blog.sql), edited from
 * /admin/blog. Public reads see published rows only (RLS). Every read
 * degrades to an empty list if the table is missing or Supabase is
 * unreachable, so the Journal pages always render.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = url && anonKey ? createClient(url, anonKey) : null;

/** Published posts, newest first. */
export async function getPosts() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error) {
    console.error('Supabase blog_posts query failed:', error.message);
    return [];
  }
  return data ?? [];
}

/** A single published post by slug, or null. */
export async function getPost(slug) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) {
    console.error('Supabase blog_posts query failed:', error.message);
    return null;
  }
  return data;
}

/** "4 min read" from the body text. */
export function readingTime(body) {
  const words = String(body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Inline emphasis + links, applied after escaping. Links only ever get
   safe hrefs: absolute http(s) or site-relative paths. */
function inline(s) {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    /* Brand rule: the name always appears in the wordmark's letter-style.
       Exact-case match only, so URLs (lowercase) are never touched. */
    .replace(/\b(SABDIA|Sabdia)\b/g, '<span class="brand-mark">$1</span>');
}

/**
 * Markdown-lite → HTML for post bodies. Deliberately small: paragraphs on
 * blank lines, ## / ### subheadings, > pull quotes, - bullet lists,
 * **bold**, *italic*, [text](link). Everything is HTML-escaped first.
 */
export function renderBody(md) {
  const blocks = String(md ?? '').trim().split(/\n\s*\n/);
  const out = [];
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const esc = escapeHtml(block);
    if (/^###\s/.test(block)) {
      out.push(`<h3>${inline(esc.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^##\s/.test(block)) {
      out.push(`<h2>${inline(esc.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^&gt;\s?/.test(esc)) {
      const quote = esc.split('\n').map((l) => l.replace(/^&gt;\s?/, '')).join('<br>');
      out.push(`<blockquote>${inline(quote)}</blockquote>`);
    } else if (block.split('\n').every((l) => /^-\s/.test(l.trim()))) {
      const items = esc.split('\n').map((l) => `<li>${inline(l.trim().replace(/^-\s+/, ''))}</li>`).join('');
      out.push(`<ul>${items}</ul>`);
    } else {
      out.push(`<p>${inline(esc.replace(/\n/g, '<br>'))}</p>`);
    }
  }
  return out.join('\n');
}

/** "24 July 2026" — en-AU long date. */
export function postDate(post) {
  const d = new Date(post.published_at ?? post.created_at);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}
