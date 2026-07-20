import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.sabdiaconstructions.com.au',
  // Server-rendered on Vercel so property edits in Supabase go live
  // immediately, with no rebuild step.
  output: 'server',
  adapter: vercel(),
  /* Astro's CSRF origin check compares against the app-perceived origin,
     which on Vercel is the internal deployment host — so it 403s every
     legitimate same-origin form POST. Each mutating endpoint carries its
     own protection instead (honeypot + rate limit on public forms,
     admin bearer auth on /api/ai). */
  security: { checkOrigin: false },
  /* Under ClientRouter a click is dead time until the new page's HTML
     arrives, and every page here is rendered on demand against Supabase —
     so that wait is a server render, not a cache hit. Prefetching on hover
     spends it before the click instead: the gap between a pointer landing
     on a nav item and the mouse button going down is usually longer than
     the fetch, so the page is already in hand.

     Deliberately "hover" rather than "viewport" — viewport would fire a
     server render for every property card in a grid the moment it scrolled
     into view, which is a lot of database work for links most visitors
     never take. */
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
});
