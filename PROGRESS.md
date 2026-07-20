# Go-Live Refine — Progress Log

## Phase 0 — Setup & safety (2026-07-20)
- **Repo:** working in `/Users/naomidurcau/Desktop/New sabdia website`, a clone of the official
  `github.com/naomisabdia-hub/sabdia-website`. Old folders `~/sabdia-website` and `~/Website`
  (NaomiSab1 remotes, outdated static site) identified and left untouched.
- **Local state:** `main` was 8 commits **ahead** of `origin/main` (unpushed work from a previous
  session: client-side routing, budget gating, ink-and-gold styling, reveal failsafes — local tags
  v3.6-client-routing, v3.7-ink-and-gold, v3.8-reveal-failsafe). Remote only has up to
  v3.5-listing-components. Remote is a strict ancestor — pushing would be a safe fast-forward.
  **Decision pending at Checkpoint 1.**
- **Env:** `.env` already present (today) — Supabase (all keys) + Clerk configured. Resend not set
  (enquiry email copies dormant; Supabase still stores leads).
- **Dev server:** runs clean on :4321 (Astro 5.18.2), no console errors on homepage.
- **Key finding:** 7 of 15 homepage images now FAIL to load — all `static.wixstatic.com` URLs.
  The Wix dependency is actively broken, not just a risk. 13 files reference wixstatic.
- **Admin:** Clerk-gated sign-in (development mode), on-brand. Needs Naomi's login for admin testing.
- **Safety:** baseline tag `v3.9-baseline` on HEAD (98413d2); working branch `refine/go-live` created.
  (Prompt's suggested v3.6–v3.8 tag names were already taken by the local work, so the scheme
  continues from v3.9.)
- Baseline screenshots taken: homepage, Caspian property page, contact, /admin — desktop + mobile.

## Phase 1 — Deep audit (2026-07-20)
- Pushed main (3f81a34→98413d2) + tags v3.6–v3.9 to origin per Naomi's go.
- Full audit written to AUDIT.md: 3× 🔴 (Wix images actively failing; no favicon; OG missing
  on 8 pages), 9× 🟡, 3× 🟢. All 16 Wix source images still downloadable — recovery window open.
- Confirmed production content flows from Supabase (properties + site_content), so the image
  migration must update DB rows too — flagged for approval at Checkpoint 2.

## Phase 2 — Own the images & performance (2026-07-20)
- Downloaded all 16 Wix-hosted originals (Sabdia's own Dropbox photography) →
  `public/images/` with semantic names; normalised to ≤3200px lean masters (21MB total);
  manifest at src/lib/image-manifest.json keeps provenance (wixId per file).
- New self-hosted resize pipeline replacing wixResize/Wix CDN entirely:
  `src/lib/images.js` (imgVariant) + `src/pages/api/img.ts` — sharp endpoint doing exact
  focal-point cover crops to WebP, immutable CDN cache headers, sources restricted to
  /images/ + the project's Supabase media bucket. lib/wix.js deleted.
- Repointed: 8 call-site files, seed-content.json (26), seed-properties.json (42),
  6 property .md (43), 3 supabase SQL seeds (138), 4 hardcoded refs.
- Production Supabase migrated (approved): 20 rows across properties/site_content/services
  rewritten; full pre-write backups in supabase/backups/2026-07-20-pre-image-migration/.
- OG images now absolutised in Base.astro (crawlers need absolute URLs).
- Mobile hero fix: phones now get true 9:16 portrait crops via <picture> (was a landscape
  frame cover-zoomed ~4×) + media-gated preloads for both crops.
- Favicon set shipped (gold "S" letterform from the wordmark on brand ink):
  favicon-16/32, apple-touch-icon, icon-512 + head links.
- Proof: 0 wixstatic refs in site code; 107/107 image URLs on 11 pages resolve; all pages
  200; no console errors; `npm run build` clean. Remaining wixstatic strings are provenance
  only (manifest wixIds, fetch script map, backups, docs).

## Phase 3 — Design, UX & accessibility (2026-07-20)
- Contrast (audit #9): VERIFIED already solved by the "accent follows the surface" system —
  automated WCAG scan across 6 pages found zero real solid-background failures (all flagged
  items were text over photos with scrims, correctly excluded). No change needed.
- Reveal timing (audit #10): elements in the first viewport now get a quick entrance
  (.fastin — 0.5s, minimal stagger) while scroll reveals keep the 0.9s editorial pace.
  (Note: the "2s blank page" observed in audit was partly the preview tool throttling
  animation clocks; the fix still meaningfully tightens first paint.)
- Phone + email (audit #8): contact page Direct Contact list and footer Connect column now
  render Phone (click-to-call tel:) and Email (mailto:) from CMS settings; phone row hidden
  until Naomi fills settings.phone in /admin. Email live (sales@sabdia.com.au).
- en-AU (audit #12): html lang="en-AU" on site + admin; US-spelling sweep of repo copy AND
  all DB content tables — already clean Australian English throughout.
- Mobile a11y: hamburger tap target enlarged to 44×44 (was 32×20) without visual change;
  verified aria-expanded/aria-hidden toggling, 71px menu links, no horizontal overflow.
- Corrections: js-yaml is NOT dead (used by properties-to-seed.mjs) — audit #15 amended;
  properties-to-seed.mjs regeneration briefly reverted QASR's 3D-viewer config because
  src/content/properties/qasr.md is STALE vs the seed/DB — reverted, flagged for handover:
  don't run that script without syncing the markdown first.

## Phase 4 — Enquiries verified (2026-07-20)
- api/contact.ts hardened: server-side email validation, substance check, 5000-char caps,
  per-instance rate limit (5/min/IP). Honeypot verified dropping silently.
- End-to-end PROVEN: contact + property-enquiry + agent-application test submissions all
  stored in Supabase `enquiries` (status 'new', email test-golive@sabdia.com.au — safe to
  delete). Invalid email/empty → 400.
- /admin leads read path verified by design (Clerk third-party auth + "Admin read access"
  RLS policy vs admin_users); runtime check with Naomi's login due in Phase 8.
- Resend: dormant (no key). Activation = RESEND_API_KEY + CONTACT_EMAIL (+CONTACT_FROM) in env.

## Phase 5 — SEO & analytics (2026-07-20)
- Base.astro: EVERY page now ships a complete share card — og:title/description/type/url/
  site_name/locale/image + twitter:card/title/description/image, with sensible defaults
  (page title/description, branded 1200×630 default image) and per-page overrides. 13/13
  pages verified with absolute og:image URLs.
- JSON-LD extended: ItemList (properties index), ContactPage (contact), BreadcrumbList
  (collection detail) — joining LocalBusiness (home) + Breadcrumb/Residence (property pages).
- Sitemap: now 28 URLs — added /privacy/, /accessibility/, all 11 collection detail pages.
- GA4: gtag wired behind PUBLIC_GA4_ID (dormant until the Measurement ID is pasted in env).
- Collection detail hero now serves sized variants (was full master).

## Phase 6 — Newsletter (MailerLite) & social (2026-07-20)
- "The Sabdia Journal" signup band above the footer on every page — CMS-editable copy
  (new `newsletter` section in admin schemas + seed), honeypot, aria-live status, on-brand
  success state. Verified live in-browser.
- /api/subscribe: MailerLite group subscribe when MAILERLITE_API_KEY + MAILERLITE_GROUP_ID
  are set; until then every signup stores to `enquiries` (form_name 'newsletter') so no
  address is lost — import into MailerLite on activation. Verified stored.
- ShareRow on property pages: Facebook/LinkedIn/X/Email + Copy link (clipboard, no 3rd-party
  scripts). Social profile links verified (footer, contact, mobile menu).
- Instagram feed embed: deliberately deferred (needs account token) — documented dormant.
