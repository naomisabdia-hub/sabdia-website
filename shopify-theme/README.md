# Sabdia — Shopify theme

A faithful port of the Sabdia website (Astro/Vercel) into a Shopify
Online Store 2.0 theme. Same stylesheet, fonts and markup — the site
renders identically; content is edited in Shopify's own surfaces.

## ⛔ Absolute content rule

No AI-generated imagery or video may depict any Sabdia property's
architecture, interiors or finishes — ever, in any form, on any surface.
Walkthrough frame sets and film clips are 100% the visualiser's real
footage. See the repo root `CLAUDE.md`.

## Where content lives on Shopify

| Content | Where |
| --- | --- |
| Page copy, hero slides, films, stats… | Theme customizer (sections & blocks) |
| Properties (QASR, SOLACE, …) | **Products** — title, description, gallery, tags (`sold`), metafields below |
| For Sale / Sold groupings | Collections with handles `for-sale` and `sold` |
| The Journal | Native Shopify **Blog** with handle `journal` |
| Nav / footer links | Navigation menus (`main-menu`, footer menus) |
| Logo, socials, contact, endpoints | Theme settings |
| Walkthrough cut per property | Product metafield `custom.scrollwalk_folder` (e.g. `qasr-v21`) |

Frames, films and clips stay on the existing media library (Supabase
`media/…`).

## Enquiry handling — two modes

Theme settings → **Site plumbing → Enquiry handling** switches every
form (contact, property enquiry, agent application, guided match,
newsletter) between:

- **Shopify** (default) — forms post through Shopify's contact endpoint:
  each enquiry is emailed to the store's **sender email** (Settings →
  Notifications) with every field included, and the enquirer is filed
  under **Customers** (newsletter signups arrive with email-marketing
  consent + a `newsletter` tag). Spam protection/captcha is Shopify's,
  toggled in Online Store → Preferences.
- **Sabdia API** — forms post to the existing Vercel endpoints
  (`forms_endpoint`), landing in the Supabase leads inbox as before.

The nav logo size is Theme settings → **Brand → Logo size** (reviewed
default 38px; mobile scales in step).

## Product metafields (namespace `custom`)

| Key | Type |
| --- | --- |
| `suburb`, `state`, `headline` | Single line text |
| `beds`, `baths`, `cars`, `land` | Integer |
| `land_over` | Boolean |
| `features` | List of single line text |
| `enquiry_heading`, `enquiry_button` | Single line text |
| `enquiry_text` | Multi-line text |
| `brochure_url`, `film_video`, `film_poster` | Single line text (URL) |
| `scrollwalk_folder` | Single line text |
| `year` | Integer |
| `series_posts` | JSON — `[{ "date", "thumb", "caption", "video"?, "url"? }, …]`, the residence's real Instagram posts, rendered by the series strip. A post with a `url` (its Instagram permalink) becomes a click-through to the real post — the view and any engagement land on Instagram; without one, videos play in the site's own player. |

First product image = page hero; images 2–7 = the gallery grid.

## Developing

```sh
# token comes from Shopify admin → Apps → Theme Access (emailed link);
# it lives in .env as SHOPIFY_CLI_THEME_TOKEN

# preview with hot reload against the store
SHOPIFY_CLI_THEME_TOKEN=<theme-access-token> shopify theme dev --store b91p0j-f4.myshopify.com --path shopify-theme

# push to the uploaded (unpublished) Sabdia theme — id 150554902630.
# The store's LIVE theme is still the Shopify default; a bare push would
# target it, so always pass --theme. (`shopify theme list` re-checks ids.)
SHOPIFY_CLI_THEME_TOKEN=<theme-access-token> shopify theme push --store b91p0j-f4.myshopify.com --path shopify-theme --theme 150554902630
```

`.shopifyignore` protects the store-side JSON templates (Naomi's
customizer edits) from pushes; it lists them one by one so brand-new
templates still reach the store on their first push — after that first
push, add the new template to `.shopifyignore` too.

`templates/product.json` (with The Series + Related residences) was
pushed on 2026-09-01 while the store copy carried no customizer edits;
it is protected from pushes again now.

Never publish without Naomi's explicit sign-off.

## Port status

- ✅ Layout, nav (+loader/veil), footer, all 11 homepage sections,
  property page (hero/specs/description/enquiry/gallery/lightbox/film),
  scroll walkthrough (verbatim player), collection grid, journal
  list/story, 404. `templates/index.json` is pre-filled with the live
  site's content.
- ✅ Dedicated page ports: About, Services, Projects, Collection,
  Contact, Agent Access, Find Your Home (`templates/page.<handle>.json`,
  pre-filled with the live copy; suffixes already assigned to the store
  pages by `shopify-app/setup-store.py`). Series strip + related-
  properties row on the property page.
- ✅ Vercel side: CORS on `/api/contact`, `/api/subscribe`, `/api/img`
  (the img route allows any origin — public immutable images drawn onto
  the walkthrough canvas).
- ✅ Collection residence pages: `/pages/collection-<name>` for all 11
  completed residences (`templates/page.collection-item.json` +
  `sections/main-collection-item.liquid`), fed by PAGE metafields
  (custom.loc / image / video / series_posts) — the editorial story is
  stitched from the strongest Series captions, film + series strip +
  more-from-the-collection included. Portfolio cards on /pages/collection
  link through.
- ✅ For Sale (`/collections/for-sale`) is the full properties-page port:
  photographic hero, refine/sort toolbar, featured-residence banner,
  sold-prior band, private-viewing CTA. Property pages also carry the
  share row and the sticky mobile enquire bar.
- 🚧 The projects-page stats band duplicates the homepage figures —
  editing one in the customizer does not update the other.
