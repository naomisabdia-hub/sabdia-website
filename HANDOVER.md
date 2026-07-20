# Sabdia Constructions Website — Handover

*Written in plain English for Naomi, Tamsin and Mo. Last updated 21 July 2026.*

---

## 1. Where the website lives

| Thing | Address | Notes |
|---|---|---|
| **The live site** | **https://sabdia-website.vercel.app** | The finished site, live now. Share this with the team. |
| Your real domain | https://www.sabdiaconstructions.com.au | **Still showing the OLD Wix site.** Switching it over is a deliberate final step — see §9. |
| Admin portal | https://sabdia-website.vercel.app/admin | Sign in with naomi@sabdia.com.au (or naomi.sabdia@gmail.com) |
| The code | github.com/naomisabdia-hub/sabdia-website | GitHub account: naomi.sabdia@gmail.com |
| Hosting | vercel.com — project "sabdia-website" | Log in with the same GitHub |
| Database | supabase.com — project "sabdia-website" | You are an Owner (naomi@sabdia.com.au). Also still owned by the old **dev@sabdia** login — once your access is confirmed, remove or re-secure dev@sabdia (ex-staff shouldn't hold keys to the leads database). |

Pushing to the `main` branch on GitHub automatically publishes the site — that's the whole deploy process.

## 2. How to edit the site (for Tamsin)

Everything meaningful is editable at **/admin** — no code, ever:

- **Site Content** — every section of every page: homepage hero, about, services text, footer, newsletter blurb, privacy pages. Pick a section, edit the labelled fields, press **Save & publish**. It's live immediately (visitors may need a refresh).
- **Properties** — add, edit, publish or retire listings. Draft listings stay hidden until "Published" is ticked.
- **Journal** (the blog) — see §3.
- **Page Sections** — add whole new sections to any page without code: text, images, quotes, photo grids, CTAs, **live Properties banners** and **live Journal strips** (they update themselves as properties/posts change). Choose the page, top or bottom, a layout, fill the fields, save.
- **Services & More** — the four services, process steps, testimonials.
- **Leads Inbox** — see §5.
- **Settings** — site name, contact email, **phone number** (type it once here and it appears on the contact page and footer with click-to-call), social links, search-engine defaults.

Long text fields have a formatting toolbar (bold, italic, headings, quotes, lists, links — all on-brand). The word "Sabdia" in Journal text is automatically set in the brand letter-style.

## 3. How to write and publish a Journal entry

1. **/admin → Journal → + New Entry.**
2. Either press **Insert starter outline** (the house structure) or use the **AI writing assistant** panel: paste your facts/notes into the notes box and press **Draft entry from notes**. The assistant never invents facts — anything it doesn't know appears as `[CHECK: …]` for you to fill in. Also on the panel: Polish, Tighten, Suggest excerpt + SEO, Suggest image alt text (it looks at the actual photo), Headline ideas. *(Dormant until the AI key is added — §7.)*
3. Fill the fields (each has help text), upload a hero image, add alt text.
4. Tick **Published** and Save. Until then it's an invisible draft.

Two draft entries are already in there as patterns to copy. The full writing guide is `BLOG_PLAYBOOK.md` in the code folder — voice, length, SEO checklist, five ready-to-write headlines.

## 4. Newsletter / EDM (MailerLite)

The signup band ("The Sabdia Journal") is live on every page. Signups currently store safely in your database (Leads Inbox → Newsletter signups tab). To connect MailerLite for sending campaigns:

1. Create a free account at mailerlite.com (500 subscribers, 12k sends/month free).
2. Create a Group (e.g. "Website signups"): Subscribers → Groups. Copy the **Group ID** (in the group's URL).
3. Get an **API key**: Integrations → API.
4. Add both in Vercel (§7): `MAILERLITE_API_KEY` and `MAILERLITE_GROUP_ID`.
5. From then on signups land in MailerLite automatically. Import the earlier ones from the Newsletter tab's **Export CSV**.
6. To send an EDM: MailerLite → Campaigns → create → send to the group.

## 5. Where enquiries go (never lose a lead)

Every form on the site — contact, property enquiries, agent applications, the Find-Your-Home guided match, newsletter — stores in the database instantly and appears in **/admin → Leads Inbox**, broken down by stream with "new" counters. **Every field a visitor fills is kept** — extras appear on the lead card automatically. Work leads with the New / Contacted / Closed status and private notes; export any tab to CSV.

To ALSO get an email copy of every enquiry: set up Resend (§7). Until then, check the Leads Inbox — that's the source of truth.

## 6. Restore points (roll back anything)

Every milestone is a named tag on GitHub. To roll the site back: `git checkout <tag>` in the code folder (or ask your developer/assistant), then push.

`v3.5-listing-components` (pre-run baseline on GitHub) · `v3.6-client-routing` · `v3.7-ink-and-gold` · `v3.8-reveal-failsafe` · **`v3.9-baseline`** (state before this go-live run) · `v3.10-images` (Wix eliminated, self-hosted images) · `v3.11-design` (UX/a11y polish) · `v3.12-enquiries-seo` · `v3.13-edm-social` · `v3.14-blog` · `v3.15-cms` · `v3.16-editorial-suite` (AI assistant, toolbar, brand mark) · **`v4.0-live`** (the deployed site).

Database safety nets: `supabase/backups/2026-07-20-pre-image-migration/` (content backups) and the audit log (every admin change is recorded).

## 7. Dormant integrations — paste a key to activate

All wired, tested and waiting. Add each key in **Vercel → project sabdia-website → Settings → Environment Variables** (choose "Production" + "Preview"), then redeploy (Deployments → ⋯ → Redeploy).

| Feature | Variable(s) | Where to get it |
|---|---|---|
| Email copy of every enquiry | `RESEND_API_KEY`, `CONTACT_FROM` | resend.com → verify the sabdia.com.au domain → API key. `CONTACT_EMAIL` is already set (Naomi@sabdia.com.au). |
| Newsletter → MailerLite | `MAILERLITE_API_KEY`, `MAILERLITE_GROUP_ID` | §4 above |
| Google Analytics | `PUBLIC_GA4_ID` | analytics.google.com → create GA4 property → Measurement ID (G-XXXX…) |
| AI writing assistant | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| Instagram feed embed | *(not built — links only)* | Ask if wanted; needs an Instagram token. |

## 8. Google after go-live

Once the real domain points at the new site:
- **Search Console**: search.google.com/search-console → add sabdiaconstructions.com.au → verify (DNS record) → submit the sitemap: `https://www.sabdiaconstructions.com.au/sitemap.xml`.
- **Google Business Profile**: claim/update at business.google.com — same name/address/phone as the site's footer.

## 9. Going fully live on sabdiaconstructions.com.au (when you're ready)

**Nothing happens to your domain until you do this.** The current Wix site keeps running meanwhile.

1. Vercel → project sabdia-website → Settings → **Domains** → add `www.sabdiaconstructions.com.au` and `sabdiaconstructions.com.au`. Vercel shows the exact DNS records.
2. At your domain registrar (wherever sabdiaconstructions.com.au is managed — possibly Wix), update the DNS records to what Vercel showed.
3. Wait for DNS (minutes to a few hours). Vercel issues the SSL certificate automatically.
4. Then do §8, and cancel the Wix plan once you're happy.

## 10. Known notes & housekeeping

- **Lighthouse (live)**: Home 90/100/100/100 (performance/accessibility/best-practices/SEO), property pages ~86/92/100/100 — the property score reflects deliberately rich imagery/3D; CLS is 0 site-wide.
- Property pages' "speed index" is tempered by the cinematic reveal animations — a design choice, not a defect.
- `src/content/properties/*.md` are STALE vs the live database (QASR's 3D viewer lives only in DB/seed). Don't run `scripts/properties-to-seed.mjs` without syncing them first.
- The 8.8MB `public/models/placeholder-home.glb` is lazy-loaded (no first-paint cost) but could be compressed someday.
- Old local folders `~/sabdia-website` and `~/Website` on the Mac are the outdated static site (NaomiSab1 remotes) — never push from them; safe to delete.
- Test leads (email `test-golive@…`, names "TEST …") can be deleted from Supabase or just marked Closed.
- Full change history: `PROGRESS.md`. Original findings: `AUDIT.md`.
