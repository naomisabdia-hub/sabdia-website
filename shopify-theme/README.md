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
`media/…`); enquiry + subscribe forms post to the existing Vercel API so
leads keep landing in the Sabdia leads inbox.

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

First product image = page hero; images 2–7 = the gallery grid.

## Developing

```sh
# preview with hot reload against the store
SHOPIFY_CLI_THEME_TOKEN=<theme-access-token> shopify theme dev --store <store>.myshopify.com --path shopify-theme

# push as a new UNPUBLISHED theme
SHOPIFY_CLI_THEME_TOKEN=<theme-access-token> shopify theme push --unpublished --store <store>.myshopify.com --path shopify-theme
```

Never publish without Naomi's explicit sign-off.

## Port status

- ✅ Layout, nav (+loader/veil), footer, all 11 homepage sections,
  property page (hero/specs/description/enquiry/gallery/lightbox/film),
  scroll walkthrough (verbatim player), collection grid, journal
  list/story, 404. `templates/index.json` is pre-filled with the live
  site's content.
- 🚧 Dedicated ports pending: About, Services, Projects, Collection,
  Contact, Agent Access, Find Your Home pages (currently render through
  the generic page shell); series strip; related-properties row.
- 🔧 Needs on the Vercel side: CORS headers on `/api/contact`,
  `/api/subscribe`, `/api/img` for the Shopify origin.
