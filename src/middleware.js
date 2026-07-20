/**
 * Edge caching for the public site.
 *
 * Every page renders on demand against Supabase (output: 'server'), so a
 * click under ClientRouter waits on a server render — and a cold Supabase
 * instance turns that into seconds. Prerendering was considered and
 * rejected: every public page (About, Services, even the legal pages) is
 * editable from the admin portal, and prerendering would freeze those
 * edits until the next deploy.
 *
 * Instead, responses carry s-maxage + stale-while-revalidate so Vercel's
 * edge cache serves repeat hits (and hover-prefetches) instantly and
 * refreshes in the background. Admin edits reach visitors within about a
 * minute — close enough to the "edits go live immediately" promise while
 * making navigation feel static.
 *
 * Admin and API routes are excluded: admin pages are prerendered shells
 * that talk to Supabase client-side, and API routes manage their own
 * caching (or must never be cached).
 */
export async function onRequest(context, next) {
  const response = await next();
  const path = context.url.pathname;
  if (
    context.request.method === 'GET' &&
    response.status === 200 &&
    !path.startsWith('/admin') &&
    !path.startsWith('/api') &&
    !response.headers.has('Cache-Control')
  ) {
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
  }
  return response;
}
