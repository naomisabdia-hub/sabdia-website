/**
 * Edge caching + security headers for the public site.
 *
 * ── Caching ─────────────────────────────────────────────────────────
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
 *
 * ── Security headers ────────────────────────────────────────────────
 * Set here rather than in vercel.json so they can be verified locally
 * against the running site (`curl -I localhost:4321`) instead of only
 * after a deploy. Middleware covers every rendered document and API
 * response; the handful of genuinely static paths (/css, /js, /fonts,
 * /images, /models) get the transport-level headers from vercel.json,
 * which middleware never sees.
 */

/* The Clerk sign-in script and its API live on the instance's own domain,
   encoded inside the publishable key. Decoding it here keeps the CSP exact
   and self-healing instead of hard-coding a host that will change. Clerk is
   dormant until the key is set, in which case nothing is added. */
function clerkOrigins() {
  const key = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return [];
  try {
    const domain = atob(key.split('_')[2]).replace(/\$$/, '');
    return domain ? [`https://${domain}`, 'https://*.clerk.accounts.dev'] : ['https://*.clerk.accounts.dev'];
  } catch {
    return ['https://*.clerk.accounts.dev'];
  }
}

/* Google's analytics endpoints, listed only when GA4 is actually switched
   on — an unused allowance is an unnecessary one. */
const GA_SCRIPT = 'https://www.googletagmanager.com';
const GA_CONNECT = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
];

function contentSecurityPolicy() {
  const ga = Boolean(import.meta.env.PUBLIC_GA4_ID);
  const clerk = clerkOrigins();
  const directives = {
    /* Nothing loads from anywhere not named below. */
    'default-src': ["'self'"],
    /* Renders, films and admin uploads all come from our own Supabase
       project; GA fires image beacons; blob:/data: cover canvas work in
       the scroll walkthrough and inline SVG. */
    'img-src': ["'self'", 'data:', 'blob:', 'https://*.supabase.co', ...(clerk.length ? ['https://img.clerk.com'] : []), ...(ga ? [GA_SCRIPT, 'https://*.google-analytics.com'] : [])],
    'media-src': ["'self'", 'blob:', 'https://*.supabase.co'],
    'font-src': ["'self'", 'data:'],
    /* The design leans on inline style attributes throughout the page
       components, so 'unsafe-inline' is load-bearing for styles. */
    'style-src': ["'self'", "'unsafe-inline'"],
    /* Likewise several is:inline scripts (loader guard, JSON-LD, GA init).
       'unsafe-inline' weakens the XSS story, but the directive still does
       real work: no script from an origin not listed here can execute. */
    'script-src': ["'self'", "'unsafe-inline'", ...(ga ? [GA_SCRIPT] : []), ...clerk],
    'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', ...(ga ? GA_CONNECT : []), ...clerk],
    /* The admin content editor previews pages in a same-origin iframe. */
    'frame-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    /* Hard denials: no plugins, no <base> rewriting, no posting a form to
       somebody else's server, and the page may only be framed by us. */
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
  };
  return (
    Object.entries(directives)
      .map(([name, values]) => `${name} ${values.join(' ')}`)
      .join('; ') + '; upgrade-insecure-requests'
  );
}

const CSP = contentSecurityPolicy();

const SECURITY_HEADERS = {
  /* Belt and braces over Vercel's own HTTP→HTTPS redirect: once a browser
     has seen this, it will not make a plaintext request to the host at all.
     Deliberately no includeSubDomains/preload while the apex domain still
     answers from Wix — both are hard to walk back, and preload in
     particular is close to irreversible. Revisit after the DNS move. */
  'Strict-Transport-Security': 'max-age=63072000',
  /* A .jpg upload can never be sniffed into executable script. */
  'X-Content-Type-Options': 'nosniff',
  /* Clickjacking. frame-ancestors above is the modern equivalent; this is
     for browsers that still only understand the old header. */
  'X-Frame-Options': 'SAMEORIGIN',
  /* Full URL to ourselves, origin only to third parties, nothing over
     plaintext — so property paths a buyer visited never leak outward. */
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  /* The site asks for none of these, so nothing embedded in it can either. */
  'Permissions-Policy':
    'accelerometer=(), autoplay=(self), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), xr-spatial-tracking=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': CSP,
};

export async function onRequest(context, next) {
  const response = await next();
  const path = context.url.pathname;

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    /* /api/img is drawn onto a canvas by the Shopify storefront and sets
       its own permissive CORS; COOP/frame rules are meaningless for an
       image and would only confuse a cross-origin consumer. */
    if (path.startsWith('/api/img') && name !== 'X-Content-Type-Options') continue;
    response.headers.set(name, value);
  }

  /* Production only. On Vercel the edge consumes s-maxage/SWR and strips
     them from the client response; the dev server passes them through,
     where the BROWSER honours stale-while-revalidate — so during local
     work, client-side navigations swap in day-old cached HTML and edits
     seem not to apply. */
  if (
    import.meta.env.PROD &&
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
