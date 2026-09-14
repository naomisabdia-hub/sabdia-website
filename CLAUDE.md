# Sabdia Website — Project Rules

## ⛔ ABSOLUTE RULE: never AI-generate the houses

**No AI-generated imagery or video may depict any Sabdia property's
architecture, layout, interiors, or finishes. No exceptions.**

- This applies to EVERY property (QASR, SOLACE, SIERRA, CASPIAN, …) and
  every surface: walkthroughs, films, galleries, posters, social content.
- "Anchored" generation (real start + end frames) is **still forbidden** —
  the generated middle invents architecture. This was tried twice for QASR
  and both times it fabricated stairs/doors that don't exist. Naomi had to
  correct it three times.
- Marketing that shows fictional architecture misleads buyers and damages
  Sabdia's credibility.
- The ONLY sources of truth for how a property looks are the visualiser's
  (Muhammad's) real renders, clips, and photos, plus the plans/models.
- For missing transitions in film cuts: use **reversed real footage**
  (a real stair descent played backwards is a real ascent — scroll-scrub
  is direction-agnostic) or a **plain crossfade**. Nothing else.
- Reversal grammar (Naomi, 2026-07-22): reversed footage is only OK where
  direction is ambiguous — stairs, lateral pans. Never reverse a walk
  through rooms: it plays as walking backwards. A return leg must be a
  real forward walk or a plain crossfade; the walkthrough must move like
  a human walking the house in order.
- AI generation (Higgsfield etc.) is permitted only for content that does
  not depict the property itself, and only within budgets Naomi sets.
- **Supervised exception (Naomi, 2026-07-22):** short transition joins
  (≤5 s) between two REAL anchor frames may be generated — but only by
  Naomi herself on higgsfield.ai, only reviewed by her frame-by-frame
  against the fabrication checklist (Desktop/QASR-transition-anchors/
  README.txt), and integrated only after her explicit per-clip approval.
  Claude never generates property architecture itself and never
  integrates an unapproved clip. Full rooms/spaces are still never
  generated. Real footage, when it exists, always beats a generated join
  — inventory the masters (w1–w6) first.
- Before concluding footage "doesn't exist", inventory EVERY folder of
  every Dropbox share completely. The full-house footage existed all along
  in "25.09.10 Walkthroughs".

## Working notes

- Deploys: push to `main` → Vercel auto-deploy (~2 min). Claude sessions
  cannot push; Naomi runs the push.
- Scroll walkthrough: `src/components/ScrollWalk.astro`; frame sets live in
  Supabase `media/scrollwalk/<slug>-vN/` (versioned folders — files are
  cached immutable, so every new cut needs a new folder). The live folder
  per property is set in Admin → Site Content → Walkthroughs (`site_content`
  key `walkthroughs`, seeded in `src/lib/seed-content.json`) — no code edit.
- Admin CMS: `/admin` (Clerk auth). All copy/images/walkthroughs editable;
  ⌘K search over every field, live preview in the content editor, guide at
  `/admin/help/`. Site is SSR — saves are live instantly, no redeploy.
- Admin can also create standalone Pages (Admin → Pages → rendered by
  `src/pages/[page].astro` at `/<slug>/`; body composed in Page Sections,
  which attach by that path; auto-included in the sitemap), manage every
  image/file at Admin → Media Library (`media` bucket; scrollwalk/archive
  folders deliberately excluded from listings), and see service health
  (domain, email alerts, analytics) in Settings via `/api/status`.
  Enquiry email alerts activate with RESEND_API_KEY + CONTACT_EMAIL in
  Vercel env; inbox replies additionally need CONTACT_FROM on a
  Resend-verified domain.
- Residence page (Shopify, since 14 Sep 2026): its own sections, each with
  only its own settings, in page order - Header (`residence-header`),
  Property page (`residence-specs`: specs bar + sold banner + sticky
  Enquire bar), About and enquiry (`residence-story`), The residence
  (`residence-gallery`, photo/video blocks), Private appointments
  (`residence-closing`), The film, The Series, More Sabdia residences
  (`related-properties`: Residence blocks or the automatic row + share
  row), Scroll walkthrough (`disabled` in the template unless the residence
  has one). `main-property.liquid` is the older all-in-one, hidden from
  ⊕ Add section; `shopify-app/split-property-page.py` then
  `shopify-app/arrange-residence-page.py <theme>` bring any store-side
  template into this shape (push-live.sh runs both).
- For Sale page (Shopify, since 14 Sep 2026): its own sections, in page
  order - Header (`collection-header`), Refine toolbar
  (`collection-toolbar`), Now selling (`collection-intro`), The residences
  (`collection-grid`: Residence blocks with a card photo hand-pick the grid,
  first block = featured banner; no blocks = automatic status-driven list;
  the filter script lives here), Sold band (`collection-sold`), How it
  works (`collection-how`), Private inspections (`collection-closing`).
  Shared snippets `collection-handles` (the list) and `collection-card`
  (one grid cell). `main-collection.liquid` is the older all-in-one,
  hidden from ⊕ Add section; `shopify-app/arrange-collection-page.py
  <theme>` moves the store-side collection template over (push-live.sh
  runs it). The same template serves /collections/sold: toolbar, Now
  selling, featured banner, sold band, how strip skip themselves there. Every
  section's Look "backdrop" dials (photo/film behind the words) are named
  Backdrop … and only show when Background = a photo or film; The film
  section has no backdrop dials at all.
- Completed residences stay Collection PAGES (Content › Pages, template
  collection-item). Since 14 Sep 2026 MILOS, PETRA, KIRRA, HERMOSA,
  ENCANTO, HAVEN, SPECTRE, AMMOS, ALHAMBRA, EDEN each have their own copy of that template
  (`page.collection-<house>.json`) whose Collection residence section
  carries the photo/film pickers and one Photo block per photograph. The
  photographs and films live in Products › <HOUSE> › Media (the per-house
  folder in the file picker, `house-room-NN.jpg`, hero first,
  `house-film.mp4`): the Admin token has no Files scope, so product Media
  is the only Shopify home for photos Claude can upload. Those products
  have Status `Completed` (skipped by every For Sale/Sold/home list) and
  their product template only redirects to the page. Never make a
  Collection home a residence product page (Naomi, 14 Sep 2026).
  Adding the next one: name map in `shopify-app/photo-names/<house>.json`,
  then `create-residence-products.py`, `add-residence-media.py <house>
  <folder> [--film …]`, `make-residence-templates.py <theme> --force`;
  push-live.sh assigns the templates and refreshes the Collection cards.
  Old-page residences still on Supabase: CALLE, ELYSIUM, FRASER, NERO.
- The public QASR cut is deliberately curated — mud room, sauna, guest
  suites, powder, dining, cellar etc. are held back pre-sale. Do not add
  rooms without Naomi's sign-off. The full private tour lives on Naomi's
  Desktop and in the private `private-media` Supabase bucket.
