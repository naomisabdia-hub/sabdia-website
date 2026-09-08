# Launch checklist — Shopify goes on sabdiaconstructions.com.au

In order. ☐ = you click it in the admin; ✎ = Claude does it once you say so. Domain and store plan are parked until you say otherwise.

## Before Thursday

1. ☐ **Duplicate the live theme** — Online Store › Themes › Sabdia › ⋯ › Duplicate. Tell me its name. *(Why: the staging theme I made cannot carry your theme settings; a duplicate can.)*
2. ✎ Push the current code to the duplicate. You preview it (⋯ › Preview) on your phone.
3. ☐ **QBCC licence number and ABN** — Customize › Theme settings › Brand. Required in Queensland for a licensed builder's advertising.
4. ☐ **Phone number** (or leave hidden) — Theme settings › Contact.
5. ☐ **Sender email → shared inbox** — Settings › Notifications › Sender email. Then **Authenticate** the sabdia.com.au domain on the same screen (adds the SPF/DKIM records at your DNS host) so enquiry emails do not land in junk.
6. ☐ **Email alerts for enquiries** — Vercel › sabdia-website › Settings › Environment Variables: `RESEND_API_KEY` (resend.com) and `CONTACT_EMAIL` (the shared inbox). Redeploy.
7. ☐ **Close the $0 checkout door** — Products › each residence › Inventory: Track quantity ✓, Available = 0, "Continue selling when out of stock" ✗. Six products. *(The API token has no inventory permission, so this one is yours.)*
8. ☐ **Turn off Shop Pay and the Shop channel** — Settings › Payments › Shop Pay; Settings › Apps and sales channels › Shop › remove.
9. ☐ **Cookie banner** — Settings › Customer privacy › Cookie banner › enable.
10. ☐ **Photos into Shopify** — drag `Desktop › Sabdia photos for Shopify` onto Content › Files, then tell me "photos are in Files". ✎ I wire all 29 spots.
11. ☐ **Old Wix URL list** — send it. ✎ Redirects added (47 known paths already done).
12. ☐ **Google Analytics** (optional) — Online Store › Preferences › Google Analytics. **Search Console** — search.google.com/search-console › add property › verify by DNS.
13. ☐ **Solicitor read** of /pages/terms and /pages/privacy (recommended; drafted to Queensland and Privacy Act requirements).
14. ☐ **Ten minutes on your own phone** on the preview: home, a residence, contact form.
15. ☐ **Publish** the duplicate — ⋯ › Publish.

## Added 9 Sep 2026 — one Status field per residence (so Tamsin can move houses)

Lands with the next push. Then, in the admin (5 minutes):
1. ☐ **Set Status on all six residences** — Products › each › scroll to Metafields › **Status**: QASR, SOLACE, SIERRA, CASPIAN = *For Sale*; CAPRI, AETHER = *Sold Prior to Completion* (or whatever is true today — AETHER back to *For Sale* if that sale fell through). Save each. Until this is done the old `sold` tag still decides, so nothing breaks either way.
2. ☐ **Make the two collections automatic** so membership follows Status and nobody has to add/remove products by hand. The API token is not allowed to, so: Products › Collections › **For Sale** › ⋯ delete it; **Create collection** › title *For Sale*, type **Automated**, "any condition": Product metafield › Status › is equal to *For Sale*; + *Under Offer*; + *Coming Soon* › Search engine listing › edit › URL handle **for-sale** › Save › Sort **Manually**, drag the order. Same for **Sold** (handle **sold**, conditions *Sold Prior to Completion* + *Sold*). Do it in one sitting: while a collection is missing, its page 404s. (If you'd rather I do it: allow the Bash rule for `python3 …/scratchpad/*.py` and say so.)
3. ☐ **Put Status at the top of the metafield list** — Settings › Custom data › Products › drag **Status** to the top so it is the first thing Tamsin sees.
4. ✎ Done by API on 9 Sep: **Projects removed from the main menu** (Collection now shows everything), `/pages/projects` → `/pages/collection` redirect, and the new product fields **Status**, **Show the scroll walkthrough**, **Build size (m²)** created. The Projects page itself still exists (Content › Pages) if you ever want it back in Content › Menus.
5. ☐ **Tamsin's login** — Settings › Users › Add staff: Online Store (themes + customizer), Products, Content (pages, files, blog). Not Settings/Billing.

## Thursday — go-live

16. ☐ **Connect the domain** — Settings › Domains › Connect existing domain › `sabdiaconstructions.com.au`. Shopify shows two DNS records: an **A record** for the root → `23.227.38.65` and a **CNAME** for `www` → `shops.myshopify.com`. Enter them at the registrar (where the Wix DNS is now). Wait for "Connected"; HTTPS issues itself within an hour.
17. ☐ **Set the primary domain** to `www.sabdiaconstructions.com.au` (Settings › Domains › ⋯ › Change primary) — Shopify then redirects the bare domain and the .myshopify address to it.
18. ☐ **Remove the storefront password** — Online Store › Preferences › Password protection ✗.
19. ✎ Live check: every page 200, forms deliver, redirects from old URLs, share cards, structured data.
20. ☐ **Submit the sitemap** in Search Console: `https://www.sabdiaconstructions.com.au/sitemap.xml`.

## After launch

- ☐ Uptime + form monitoring (a weekly test enquiry is the simplest).
- ☐ Store plan review — Advanced (~US$399/mo) vs Basic for an enquiry-only site.
- ☐ **Monday.com push** is built — add `MONDAY_API_TOKEN` in Vercel (see ENQUIRY-FLOW.md) and every enquiry lands on Lead Pipeline. n8n: set `LEAD_WEBHOOK_URL` when Heston's stack is ready.
- ☐ Staff access — Settings › Users: give Tamsin a staff account with Online Store + Content permissions rather than sharing yours.

## Added 8 Sep 2026 — after the vibecoded-site checklists audit

Done in the theme (lands with the next push to staging): video option on the Hero slideshow; About image-strip size controls; a real password form on the locked-store page; residence photo lightbox now opens; "Privacy Policy" link after every enquiry note; meta description on every page; share image cropped to 1200×630; width/height on all images (no layout jump); three contrast fixes; `eb-garamond` preloaded; no console output in production; the Sabdia enquiry API now rejects POSTs from unlisted origins.

Still yours to do in the Shopify admin:
1. ☐ **Accessibility page** — the footer links `/pages/accessibility`; create Content › Pages › "Accessibility" (text in `src/pages/accessibility.astro`) or remove the link (Content › Menus › Legal).
2. ☐ **Phone number** — Theme settings › Contact; without it the tel: row in the footer and contact page does not show.
3. ☐ **Cookie banner** — Settings › Customer privacy › Cookie banner (before any GA4).
4. ☐ **GA4 + Search Console** — Online Store › Preferences.
5. ☐ **Password page copy** — Customize › Password page (default copy is a placeholder "Something considered is on its way").
6. ☐ Optional: spam captcha (Settings › Customer privacy › "Enable reCAPTCHA" covers Shopify forms only; the Sabdia API forms rely on honeypot + rate limit).
