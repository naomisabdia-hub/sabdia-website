# Sabdia Shopify site — audit (8 September 2026)

Store `b91p0j-f4.myshopify.com` · live theme **Sabdia** #150554902630 · staging theme **Sabdia staging (Claude)** #150783361126 (unpublished — preview: `https://b91p0j-f4.myshopify.com?preview_theme_id=150783361126`).

## What this theme is

Not Dawn and not a paid theme. Every file is hand-written: an Online Store 2.0 port of the Sabdia Astro site, sharing the same stylesheet, fonts and markup. Nothing is left over from a demo — the "placeholder" matches in the scan are input placeholders. The 11 required routes the site does not use (cart, search, account, password, list-collections) render a neutral "not in use" shell inside the design.

## Issue log

| Page | Issue | Severity | Fixed? | How |
|---|---|---|---|---|
| All | No security headers on the Astro copy | High | Yes | CSP, HSTS, nosniff, frame, referrer, permissions in middleware (Shopify sets its own) |
| All | No Terms of Use page | High | Yes | `/pages/terms` created from the same document as the Astro page |
| All | Privacy Policy silent on overseas storage (APP 8), retention, breaches | High | Yes | Three sections added; cookies section rewritten for consent-gated analytics |
| Contact, Agent | No privacy notice at the point of collection (APP 5) | Medium | Yes | Link to the policy beside both forms |
| Footer | No QBCC licence number / ABN (Queensland advertising requirement) | **Blocker** | Field built | Theme settings › Brand — **Naomi enters the real numbers** |
| Home, Services, residences | Horizontal scroll on phones (25 px at 375, 8 px at 360) | High | Yes | `aspect-ratio`+`min-height` grid trap, reveal offsets — verified 320–1440 |
| Nav (scrolled) | CTA gold on cream, 3.05:1 | Medium | Yes | Ink text, gold border (14.07:1) |
| All forms | Server's refusal reason discarded ("Something went wrong") | Medium | Yes | Actual reason shown and announced |
| Residence pages | Enquiry select and message box unlabelled; series cards' accessible name ≠ caption | Medium | Yes | `for`/`id` pairs; aria-label leads with caption |
| Mobile menu | Closed menu still in the tab order (`aria-hidden` + focusable) | Medium | Yes | `visibility:hidden` while closed |
| Cart / search | Shop-language titles ("Your Shopping Cart") | Low | Yes | Neutral titles by template |
| All | No Organization / LocalBusiness structured data | Medium | Yes | `snippets/structured-data.liquid`, built from theme settings only |
| Non-product pages | No social share image | Medium | Yes | Bundled 1200×630 default; override in Theme settings › Search & sharing |
| Projects | "Queensland" where the Sabdia site says "QLD" | Low | Yes | Card prints QLD |
| All copy | AI-sounding phrasing across About, home, Services, residences | High (brand) | Yes | Two editing passes, 60+ strings, both sites; Instagram captions and legal pages untouched |
| Theme | 69 visible strings hard-coded | Medium | Yes | All are editor settings ("Wording" headers; card chips under Theme settings › Labels) |
| Theme | Every image spot needs a picker | Medium | Yes | Picker-first everywhere; URL fallback relabelled "Current photo (URL)"; film uploads |
| Theme | Nowhere to put a set of photos | Medium | Yes | Photo gallery section (50 photos, 4 structures, full-screen viewer) |
| Store | 29 photos served from the Vercel site | Medium | **Needs you** | API token lacks Files scope; folder prepared on Desktop — drag into Content › Files, then say so |
| Store | Products are $0.00 and available for sale — `/cart/add` → checkout is reachable by URL | Medium | **Decision** | See below |
| Store | Enquiry sender email is naomi@sabdia.com.au (personal) | Medium | **Decision** | Settings › Notifications |
| Store | Email alerts for enquiries not configured (RESEND keys unset) | Medium | **Needs you** | Vercel env vars, or switch to Shopify mode |
| SEO | Old Wix URLs | Medium | Partly | 47 redirects for known paths; **send the full old URL list** |
| Lighthouse | Mobile perf 66 (home) / 67 (QASR); LCP 5–10 s through the dev proxy | Medium | Open | Real-world will be better; hero images are already responsive; walkthrough frames dominate QASR |
| Lighthouse | "Legible font sizes" — labels at 9–11 px | Low | **Decision** | Design choice (small-caps labels); body text is 13 px+ |
| Analytics | GA4 / Search Console not set | Low | **Needs you** | Online Store › Preferences; search.google.com/search-console |

Verified clean: console errors on 16 templates (only Shopify's own `shop.app` frame on the dev host), 30/30 page pairs identical to the Sabdia site sentence-for-sentence, every image has alt text, zero broken internal links or assets (37 pages, 154 assets), no horizontal scroll at 360/390/768/1024/1440, forms at every response state, structured data present, 404 page branded, copyright year automatic.

## Decisions needed

**1. Neutralise "add to cart" (products are $0.00, purchasable by URL).**
Options: (a) Products › each residence › Inventory › track quantity, set 0, don't allow purchase when out of stock — `/cart/add` then refuses; page unchanged. (b) Delete the Online Store checkout entirely — impossible on Shopify. (c) Leave it — a visitor would have to hand-type `/cart/add?id=…`.
**Recommendation: (a)**, six clicks, no visible change, closes the door.

**2. Where enquiry emails go.** Sender email is your personal address. Options: change to a shared inbox (sales@sabdia.com.au) in Settings › Notifications and authenticate the sabdia.com.au domain there (SPF/DKIM) so mail is not junked; or keep personal.
**Recommendation: shared inbox + authenticate the domain**, before launch.

**3. Enquiry backend: keep the Sabdia API, or go Shopify-native?** Today every form posts to `sabdia-website.vercel.app/api/contact` (stored in Supabase, Leads Inbox, honeypot, rate limit, CORS-locked). Shopify-native emails the sender address and stores nothing. See `ENQUIRY-FLOW.md`.
**Recommendation: keep the Sabdia API** and add the Monday.com push there.

**4. Small label sizes on mobile (9–11 px).** Lighthouse flags them; they are the brand's small-caps labels, and body copy is 13 px+. Raising them changes the look.
**Recommendation: leave**, unless you find them hard to read on your own phone.

**5. Shop app / Shop Pay scripts.** Shopify injects them because the store has a checkout. Settings › Payments › Shop Pay (off) and Sales channels › Shop (remove) drop the third-party cookies Lighthouse flags.
**Recommendation: turn both off** — nothing is sold.

## Known limits of this audit

- Lighthouse and axe ran through the local theme-dev proxy, which adds latency and Shopify's dev scripts; real numbers will be somewhat better. axe's 27 contrast flags were all footer text scored against the page background because the footer sat outside the tool's viewport — verified the footer is dark and the text 14:1.
- The staging theme carries the code and the customizer content, but not theme *settings* (logo, colours, contact) — the API token cannot read `config/settings_data.json`. For publishing, duplicate the live theme in the admin (exact copy) and I push code to that copy.
- Physical-device testing was not possible from here; ten minutes on your own phone is still worth it.
