# Where an enquiry goes

## Shopify is the front door (added 9 September 2026)

Every enquiry and newsletter signup is now also written into **Shopify › Customers**: the person is created or updated, tagged `website`, `form:<which form>`, `residence:QASR` (etc.), `type:<enquiry type>`, `agent` for agent applications, `newsletter` for signups, and the dated message goes on the customer's note. Newsletter signups are marked as subscribed to email marketing. That gives you, inside Shopify:

- **Customers › filter by tag** - a per-residence list (`residence:QASR`), all website leads (`website`), all agents (`agent`).
- **Marketing › Shopify Email** - segments from those same tags, so the Journal or a release announcement goes to exactly the right people without exporting anything.

Supabase (Leads Inbox), monday.com and the email alert all still receive the same enquiry - Shopify is the copy you work from, the others are the record and the pipeline.

**To switch it on (one-time):** in Shopify admin › Settings › Apps and sales channels › Develop apps › the Sabdia app › Configuration › Admin API scopes: add `read_customers` and `write_customers`, save, then in Vercel › sabdia-website › Environment Variables add `SHOPIFY_STORE` (`b91p0j-f4.myshopify.com`) and `SHOPIFY_ADMIN_TOKEN` (the app's Admin API access token - if Shopify issues a new one after the scope change, use that) and redeploy. Until then the hand-off logs one line and skips; nothing else is affected.


## Today (verified 8 September 2026 by submitting a real test enquiry from the storefront's own request and finding it in the database)

```
Visitor fills a form on the Shopify site
  (contact page · homepage band · residence enquiry · agent application · guided match · newsletter)
        │
        ▼  POST, cross-origin, allowed only from the Sabdia domains
https://sabdia-website.vercel.app/api/contact   (newsletter → /api/subscribe)
        │  honeypot field → bots get a fake "ok"
        │  server-side validation → real reason returned ("A valid email address is required")
        │  rate limit → 6th post in a minute from one address is refused
        ├──────────────► Supabase table `enquiries`  →  Leads Inbox at sabdia-website.vercel.app/admin/leads/
        │                (tag, reply, export CSV; every field kept, nothing dropped)
        └──────────────► Email alert via Resend   ✗ NOT configured (RESEND_API_KEY / CONTACT_EMAIL unset)
```

The visitor sees the button change to "Thank you — we'll be in touch shortly", announced to screen readers too.

**What is captured**

| Form | Fields |
|---|---|
| Contact (page + homepage) | first name, last name, email, phone, interest, message |
| Residence enquiry | the residence, name, email, phone, enquiry type, message |
| Agent application | name, agency, email, phone, licence number, suburb markets, notes |
| Guided match | the answers, enquiry type, message |
| Newsletter | email (stored as form `newsletter`; goes to MailerLite once keys are set) |

**Shopify's own alternative** (Theme settings › Site plumbing › Enquiry handling → "Shopify"): each form emails the store's **Sender email** (Settings › Notifications — currently naomi@sabdia.com.au) and files the person under Customers. Submissions are **not stored** anywhere else, there is no inbox, and spam protection is Shopify's captcha. The newsletter form creates a Customer with marketing consent.

## Recommended future flow

```
form → /api/contact ──► Supabase (as now)
                    ──► Monday.com  Leads board  (new item per enquiry, columns = fields)
                    ──► LEAD_WEBHOOK_URL  (n8n, when Heston's stack is ready)
                    ──► email alert (Resend) to the shared inbox
```

**Why this and not the others**

| Option | Cost | Pros | Cons |
|---|---|---|---|
| **Server-side push from `/api/contact`** (recommended) | $0 — Monday API is included in the plan | We own the code; every field mapped exactly; no third-party in the loop; one env var to add n8n later | Needs a Monday API token in Vercel |
| Shopify Flow | $0 | Native | Has no trigger for contact-form submissions — cannot see them |
| Zapier / Make | US$20–30/mo | No code | Another vendor, another login, field mapping in a UI, emails parsed from text |
| Form app with webhooks | US$10–20/mo | Storage + webhooks | Replaces the forms we already have; design would need rebuilding in the app |

**Built (8 Sep 2026), dormant until switched on.** `/api/contact` now creates an item on the **Lead Pipeline** board (Admin workspace, group *Active*) after storing the row: name, date, Source = Website, phone, email, interested residence (QASR / Solace / Aether / Sierra / Ascot), and everything else in Notes. To switch it on: monday.com › your avatar › Developers › My access tokens → copy → Vercel › Environment Variables › `MONDAY_API_TOKEN` → Redeploy. `LEAD_WEBHOOK_URL` does the same for n8n with no further code. Neither can ever block or fail an enquiry — they run after it is stored, and errors only go to the server log.

**Before launch, regardless:** set `RESEND_API_KEY` and `CONTACT_EMAIL` (shared inbox) in Vercel so every enquiry also arrives by email within seconds.
