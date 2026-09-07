# Where an enquiry goes

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

**To build it (about an hour):** a Monday API token (monday.com › avatar › Developers › My access tokens) and the Leads board ID go into Vercel as `MONDAY_API_TOKEN` / `MONDAY_BOARD_ID`; `/api/contact` creates the item after storing the row. A `LEAD_WEBHOOK_URL` variable does the same for n8n with no further code.

**Before launch, regardless:** set `RESEND_API_KEY` and `CONTACT_EMAIL` (shared inbox) in Vercel so every enquiry also arrives by email within seconds.
