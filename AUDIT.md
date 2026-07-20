# Site Audit — 2026-07-20 (Phase 1 of go-live refine)

Audited on branch `refine/go-live` @ 98413d2 (`v3.9-baseline`), dev server against the
live Supabase project. Severity: 🔴 must fix · 🟡 should fix · 🟢 polish/nice-to-have.

**Overall:** the site is in strong shape. Every public page returns 200 with a unique
title, meta description, canonical URL, exactly one `<h1>`, and a proper branded 404.
Forms have labels, `required`, `autocomplete`, honeypot and an `aria-live` status line.
`:focus-visible` styling, skip-link, reduced-motion handling and alt text are all present.
RLS is enabled on every table with sane policies; no secrets in git history; `.env*`
git-ignored. The findings below are the gap between "strong" and "client-ready luxury."

---

## 🔴 Critical

### 1. Every image is hot-linked from the old Wix CDN — and it is failing TODAY
- 16 unique source images (incl. the logo), 55 transform-variant URLs, referenced across
  13 repo files (`src/lib/seed-content.json` ×26, `src/lib/seed-properties.json` ×42,
  6 property markdown files, [wix.js](src/lib/wix.js), [about.astro](src/pages/about.astro),
  [services.astro](src/pages/services.astro), [AdminShell.astro](src/layouts/AdminShell.astro),
  [admin/login.astro](src/pages/admin/login.astro)).
- **Live breakage observed:** 7 of 15 homepage images currently fail in-browser — the
  `enc_avif` resize transforms built by `wixResize()` ([wix.js:7](src/lib/wix.js:7)) are being
  rejected/throttled by Wix. The homepage hero renders as a blank grey gradient.
- All 16 **base** URLs still return 200, so full recovery by direct download is possible now.
  This window may close if the Wix account lapses.
- **Supabase matters too:** with env configured, pages render from the `properties` and
  `site_content` tables ([db.js:54](src/lib/db.js:54), [content.js:22](src/lib/content.js:22)),
  whose rows embed the same Wix URLs (homepage HTML carries 43 wix references). Phase 2 must
  update the DB rows as well as the repo files, or nothing changes in production.

### 2. No favicon or app icons at all
- `public/` contains no favicon/icon files and `Base.astro`'s head has no icon links
  ([Base.astro:25-55](src/layouts/Base.astro:25)). Browser tabs show a blank page glyph —
  instantly undercuts "established luxury operation." Needs favicon.svg/ico + apple-touch-icon
  + og-image defaults, generated from the (self-hosted) logo.

### 3. Social share (OG/Twitter) tags missing on 8 of 13 public pages
- OG tags are conditional on each page passing `ogTitle` ([Base.astro:43-47](src/layouts/Base.astro:43));
  only `/`, `/about/`, `/services/`, `/collection/[slug]`, `/properties/[slug]` pass them.
  Missing: projects, collection index, properties index, contact, agent-access,
  find-your-home, privacy, accessibility.
- Also missing site-wide even where OG exists: `og:url`, `og:site_name`, `og:locale`,
  `twitter:title/description/image`. No default `og:image` fallback (CMS has a
  `settings.seo.ogImage` field — [schemas.js:48](src/lib/admin/schemas.js:48) — that Base.astro
  never reads). A shared link to /contact/ renders bare.

## 🟡 Important

### 4. Structured data stops at home + property pages
- JSON-LD only in [index.astro](src/pages/index.astro) (1 block) and
  [properties/[slug].astro](src/pages/properties/[slug].astro) (2 blocks). No
  `LocalBusiness`/`HomeAndConstructionBusiness` on contact/about, no `BreadcrumbList`
  anywhere, no `ItemList` on the properties index. (BlogPosting comes with Phase 7.)

### 5. Sitemap omissions
- [sitemap.xml.ts:4-14](src/pages/sitemap.xml.ts:4) lists 9 static paths + properties, but
  omits `/privacy/`, `/accessibility/` and the collection detail pages
  (`/collection/[slug]` exists as a route). No `<lastmod>`. Blog routes must be added in Phase 7.

### 6. No explicit image dimensions → layout shift
- Zero `<img>` elements in `src/` carry `width`/`height` attributes (grep: 0 matches).
  Cards, galleries and about/services imagery all reflow as images arrive. Fix alongside the
  Phase 2 self-hosting pass (real dimensions become known at download time).

### 7. Contact API accepts an empty record; no rate limiting
- [api/contact.ts:34-46](src/pages/api/contact.ts:34) builds the record with every field
  nullable and inserts without validating that email/name/message exist or that email looks
  like an email. The honeypot ([contact.ts:32](src/pages/api/contact.ts:32)) is the only spam
  defence — no rate limit, so a bot that fills the honeypot correctly can flood `enquiries`.
  Add minimal server-side validation + a light rate limit; client already marks fields `required`.

### 8. No phone number or click-to-call anywhere on the public site
- `settings.phone` exists in the CMS ([schemas.js:32](src/lib/admin/schemas.js:32)) but is
  never rendered — not in [Footer.astro](src/components/Footer.astro), not on
  [contact.astro](src/pages/contact.astro). No `tel:` link on mobile. Also hurts local SEO:
  no NAP (name/address/phone) block for LocalBusiness markup. (Needs Naomi to confirm the
  number to publish — do not invent one.)

### 9. Small gold text on cream fails AA contrast
- Gold `--gold: #B49B5A` on cream `#F7F3EB` ≈ 3.3:1 — fine for large display text,
  fails 4.5:1 for the small tracked-caps eyebrow labels used site-wide
  (e.g. `.slabel` styling in [style.css](public/css/style.css)). Darken the small-text
  gold (e.g. toward `#8a7440`) or bump those labels to large-text sizing.

### 10. Content can sit invisible ~1.5–2s after navigation
- The reveal system ([main.js:330-367](public/js/main.js:330)) has good backstops, but on a
  fresh navigation the contact page visibly rendered blank for ~2s before revealing (observed
  in this audit). Consider shorter delays/durations for first-viewport reveals so the page
  never *reads* as broken.

### 11. `/admin` leads view depends on an unverified read path
- `enquiries` has RLS enabled with **no select policy** ([schema.sql:71](supabase/schema.sql:71)
  comment says "read only in the Supabase dashboard"), yet [admin/leads.astro](src/pages/admin/leads.astro)
  renders a leads table. Whether it reads via service role or an authed policy from
  [clerk-auth.sql](supabase/clerk-auth.sql) needs a logged-in test (Phase 4) — if it silently
  shows nothing, missed-lead risk.

### 12. `lang="en"` and en-US spellings
- [Base.astro:24](src/layouts/Base.astro:24) declares `lang="en"`; should be `en-AU`, and
  copy should be swept for Australian English during Phase 3 (client rule #8).

## 🟢 Polish

### 13. 8.8MB `placeholder-home.glb` ships in the repo
- [public/models/placeholder-home.glb](public/models/placeholder-home.glb). The viewer lazy-loads
  models behind a poster + explicit user action ([PropertyViewer.astro:120-126](src/components/PropertyViewer.astro:120)),
  so first paint is safe — but 8.8MB is heavy for a placeholder; compress (Draco/meshopt) or drop.
- `public/js/vendor/model-viewer.min.js` (~1MB) is correctly deferred until viewer use.

### 14. Sitemap `<lastmod>`, `og:type=article` for future blog, `theme-color` only light
- Minor head/meta niceties; fold into Phases 5/7.

### 15. Tidy-ups
- `.env.backup-pre-clerk` sits in the working dir (git-ignored, but stale — delete once Clerk
  is confirmed working in prod).
- `wixResize()` and `mediaKey()` gallery-dedupe logic ([db.js:71-86](src/lib/db.js:71)) become
  dead code after Phase 2 — retire with the migration.
- `devDependencies: js-yaml` appears unused by any script — remove.

---

## Already-planned build items (not defects)
Newsletter/EDM (Phase 6) · GA4 + Search Console (Phase 5) · Blog + BlogPosting JSON-LD
(Phase 7) · Instagram feed (optional, Phase 6) · Resend activation (Phase 4).

## Proposed fix order
1. **Phase 2 (images)** closes #1, #6, and half of #2 (self-hosted logo enables favicon set) —
   includes migrating the Supabase `properties` + `site_content` rows off Wix URLs
   (**needs Naomi's approval to write to production Supabase**, backed up via seed export first).
2. **Phase 3 (design/UX/a11y)** closes #2, #9, #10, #12 + AU-English sweep.
3. **Phase 4 (enquiries)** closes #7, #11.
4. **Phase 5 (SEO/GA4)** closes #3, #4, #5, #14.
5. #8 (phone) lands in Phase 3/5 once Naomi confirms the number to publish.
6. #13/#15 fold into their nearest phase.
