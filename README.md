# Sabdia Constructions — Website

Marketing site for Sabdia Constructions, built with [Astro](https://astro.build),
backed by a [Supabase](https://supabase.com) database, and deployed on
[Vercel](https://vercel.com).

- **Properties live in Supabase** — edit a row in the `properties` table and
  the website updates immediately (pages are server-rendered, no rebuild).
- **Site content lives in Supabase too** — homepage sections, nav, footer and
  global settings are jsonb documents in `site_content`; services, process
  steps and testimonials have their own tables. All fall back to
  `src/lib/seed-content.json` when Supabase is unreachable.
- **Fonts are self-hosted** — variable woff2 files in `public/fonts/`
  (no Google Fonts request at runtime).
- **Enquiries are saved to Supabase** — every form submission (contact,
  property enquiry, agent application) lands in the `enquiries` table, and can
  optionally be emailed to you via Resend.
- If Supabase isn't configured yet, the site still works: it renders from the
  bundled seed data in `src/lib/seed-properties.json`.

## Development

```bash
npm install
npm run dev      # local dev server at http://localhost:4321
npm run build    # production build
```

## Project structure

```
src/
  pages/                # one .astro file per page
  pages/properties/     # listing page + [slug].astro (one template, every property)
  pages/api/contact.ts  # form endpoint → Supabase enquiries (+ optional email)
  components/           # Nav, Footer, PropertyCard, SoldCard
  layouts/Base.astro    # shared <head>, nav, footer
  lib/db.js             # property data layer (Supabase, with seed fallback)
  lib/seed-properties.json
  content/properties/   # original markdown content (source for the seed)
supabase/
  schema.sql            # tables + row-level security policies
  seed.sql              # inserts the current six properties
public/                 # css, js, static assets
scripts/properties-to-seed.mjs  # regenerates seed JSON/SQL from the markdown
vercel.json             # 301 redirects from the old .html URLs
```

## One-time setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the project, open **SQL Editor** and run the contents of
   `supabase/schema.sql`, then `supabase/seed.sql`, then
   `supabase/seed-content.sql`.
3. Copy from **Project Settings → API**:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

### 2. Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import
   `NaomiSab1/Website`. Astro is auto-detected.
2. Under **Settings → Environment Variables**, add the three Supabase
   variables above (and optionally the Resend ones below), then redeploy.
3. Add your custom domain under **Settings → Domains**.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | Public read access to properties |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side insert of enquiries |
| `RESEND_API_KEY` | optional | Email a copy of each enquiry ([resend.com](https://resend.com)) |
| `CONTACT_EMAIL` | optional | Address that receives those emails |
| `CONTACT_FROM` | optional | Verified sender address |

## Editing properties

Open Supabase → **Table Editor → properties**. Each row is one property; the
site reads them live, ordered by `display_order`.

- Add a row → the property appears everywhere (listing page, home page grid,
  projects page, footer, contact-form options) and gets a page at
  `/properties/<slug>/`.
- Set `status` to `sold` → it moves to the "Sold Prior to Completion"
  sections and its page switches to the sold layout.
- `features` and `gallery` are JSON columns — copy an existing row's format.
- The `headline` may contain `<br>` and `<em>` tags.

Enquiries arrive in **Table Editor → enquiries**, newest first.

## Versions

Site versions are marked with git tags:

- `v1.0-static` — original hand-written HTML site
- `v2.0-astro` — Astro rebuild, markdown content + Decap CMS
- `v3.0-astro-supabase` — Astro + Supabase database (current)
