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

## The Journal signup - where the email goes (checked 11 September 2026)

**Short answer.** The Journal band in the footer is Shopify's own "customer" form. An address typed there goes straight into **Shopify admin › Customers** on the store (b91p0j-f4.myshopify.com): a Customer record with that email, **Email subscription: Subscribed**, tagged `newsletter` (plus the house, for example `solace`, when the person signed up from a residence page). It does not go to Supabase, the Leads Inbox, MailerLite, monday.com or any mailbox, and **nobody is notified**. The address sits in Customers until you send the Journal from Marketing › Shopify Email. The earlier sections of this document describe "Sabdia API" mode; the live theme setting is **Shopify** mode (Theme settings › Site plumbing › Enquiry handling = "Shopify", `form_backend = "shopify"` in the store's `settings_data.json`), which is the path below.

### The path, step by step

1. **The band** is `shopify-theme/sections/footer.liquid`, rendered on every page by the footer group. In Shopify mode it outputs `{% form 'customer' %}`. This is the exact HTML the dev preview renders on the homepage (nothing was submitted to get it):

   ```html
   <form method="post" action="/contact#nlForm" id="nlForm" accept-charset="UTF-8" class="nl-form">
     <input type="hidden" name="form_type" value="customer">
     <input type="hidden" name="utf8" value="✓">
     <span hidden data-nl-success>Welcome - you're on the list.</span>
     <input type="hidden" name="contact[tags]" value="newsletter">
     <input class="nl-in" id="nlEmail" type="email" name="contact[email]" placeholder="Your email address" required>
     <button class="nl-btn" type="submit">Subscribe</button>
   </form>
   ```

   On `/products/solace` the hidden tag field reads `newsletter, solace`, so a signup from a residence page is also tagged with that house. Only the email is asked for: no name, phone or message is stored for a Journal signup.

2. **Pressing Subscribe.** `shopify-theme/assets/main.js` (`nativeFormInit`, the `isNews` branch) posts the form to Shopify's `/contact` endpoint in the background, so the page never reloads. Shopify's spam script runs first: the store has hCaptcha switched on (Online Store › Preferences › Spam protection; its loader is in every page), and for almost everyone it passes invisibly.

3. **What Shopify does with `form_type=customer`.** It creates a Customer with that email, or updates the Customer that already has that address, sets their email marketing consent to **Subscribed**, and applies the `contact[tags]` list. Shopify's own words for this form: a customer "will be created with the entered email, and the accepts_marketing attribute … will be set to true". If double opt-in is switched on for the store, the status is **Pending** instead until the person clicks the confirmation email Shopify sends them (see "Only you can confirm" below).

4. **The success message.** Shopify answers with a redirect back to the same page with `?customer_posted=true`. The script sees that and swaps the form for the success text (Customize › Footer › Newsletter band › Success message, currently "Welcome - you're on the list."). If the address is rejected (for example, not a valid email), Shopify's error text is shown under the button instead and the button comes back.

5. **The challenge branch.** If hCaptcha wants a visible check, Shopify answers with a `/challenge` page; the script sends the visitor there. Once they pass, Shopify files the address and returns them to the page they were on with `?customer_posted=true`, and the footer itself renders the success message server-side (`form.posted_successfully?`). Verified without submitting anything: `GET /?customer_posted=true` on the preview renders `<p class="nl-done">Welcome - you're on the list.</p>` in the band; `GET /?contact_posted=true` (the enquiry form's parameter) does not.

6. **Where it is visible in the admin.**
   - **Customers › Segments › Email subscribers** - Shopify's built-in segment: everyone whose email subscription is Subscribed. This is the Journal list.
   - **Customers › Add filter › Tagged with › `newsletter`** (or type the tag in the Customers search) - everyone who asked for the Journal, whether from the band or the "Keep me updated" box on an enquiry.
   - **Per residence:** Customers › Segments › Create segment, query `customer_tags CONTAINS 'qasr' AND email_subscription_status = 'SUBSCRIBED'` (the editor autocompletes the filter names). The house tag is shared with the enquiry mirror, so without the second half you get enquirers as well as subscribers.
   - On the person's own page: Email subscription (Subscribed, with the date) and Tags.

7. **Who gets notified.** Nobody. Shopify sends no staff email for a customer-form signup (it does email the store's Sender email for an *enquiry*, because that is a contact form). There is no Supabase row, no monday.com item, no Resend alert and no Shopify Inbox message. If you want to know the day someone signs up, set up the Flow below.

8. **Sending the Journal.** Marketing › Campaigns › Create campaign › **Shopify Email** (a free Shopify app; add it from that screen if asked) › To: the **Email subscribers** segment, or a segment you made above › design › send. Nothing is exported; the list keeps itself from the forms. At the time of writing Shopify Email includes 10,000 emails a month at no charge.

9. **An alert per signup (Shopify Flow, free).** Apps › **Shopify Flow** (install it from the Shopify App Store if it is not there yet) › Create workflow › Select trigger › **Customer subscribed to email marketing** (this fires for a brand-new address and for an existing customer who subscribes; **Customer created** is the alternative, but it misses an existing customer who signs up later) › Add condition › Customer › Tags › contains `newsletter` (keeps enquiry mirrors that do not carry the tag out of the alert) › Add action › **Send internal email** › Email: the address that should hear about it (comma-separate more than one; Shopify does not allow a variable here) › Subject: for example `New Journal subscriber` › Message: for example `{{ customer.email }} - tags: {{ customer.tags | join: ", " }}` › Turn on workflow. Flow sends from the store's sender address.

10. **The other setting, so you know it exists.** Theme settings › Site plumbing › Enquiry handling = **Sabdia API** switches the band to a plain form posting to `https://sabdia-website.vercel.app/api/subscribe` (Theme settings › Forms endpoint; the default). That endpoint (`src/pages/api/subscribe.ts` in the Astro app): honeypot field, email validation, 5 posts a minute per address, then tries to file the person in Shopify Customers through the Admin API (tags `website` + `newsletter`, subscribed) - which does nothing today because the app's token has no customer scopes - then MailerLite if `MAILERLITE_API_KEY` + `MAILERLITE_GROUP_ID` are set (they are not), otherwise a row in Supabase `enquiries` with form `newsletter`, visible in the Leads Inbox at sabdia-website.vercel.app/admin/leads/. In that mode the address does **not** reach Shopify Customers, and the enquiry forms move to `/api/contact` as well. The Astro app is the dormant backup, so leave this on Shopify unless you mean to move everything.

### "Keep me updated" on the enquiry forms

The box (`snippets/form-optin.liquid`, ticked by default) sits on the homepage contact band (`contact-cta.liquid`), the contact page (`main-contact.liquid`), every residence enquiry (`main-property.liquid`) and the agent application (`agent-apply.liquid`). The concierge has one too but is switched off.

- The enquiry itself is Shopify's **contact** form: it emails the store's Sender email (Settings › Notifications) and creates no Customer on its own.
- Once Shopify accepts it, `main.js` (`fileCustomer`) copies the details into the hidden **customer mirror** next to the form (`snippets/customer-mirror.liquid`, a second `{% form 'customer' %}`) and submits that in the background about 1.5 s later: first name, last name, email, phone, a note (residence, interest, budget, timeline, locations, message, "Via /products/solace on 11/09/2026") and the tags `enquiry`, the house (`solace`, from the page or from a house named in the form), the enquiry type (`arrange-private-inspection`), `budget-…`, `timeline-…`, `loc-…`, and **`newsletter` only when the box was ticked**. If the enquiry went through the challenge page, the same details are kept in the browser for 30 minutes and filed when the visitor returns.
- So yes: an enquiry with the box ticked lands in the **same Customers list**, tagged `newsletter` plus `enquiry`, the house and the type. Customers › Tagged with `newsletter` shows both kinds side by side; the enquiry ones also carry `enquiry`.
- **One thing to be aware of:** the mirror is a Shopify customer form, and Shopify's rule for that form type is to mark the person as subscribed. Read literally, that means every accepted enquiry, even with the box **unticked**, appears as **Subscribed** in the built-in Email subscribers segment; the box only decides whether the `newsletter` tag is added. If that is confirmed (test below), send the Journal to a segment on the tag (`customer_tags CONTAINS 'newsletter' AND email_subscription_status = 'SUBSCRIBED'`) rather than to the whole Email subscribers segment, so only people who asked receive it. Fixing it properly means filing enquirers through the Admin API instead of the hidden form, which needs the customer scopes described at the top of this document.
- Shopify documents only `contact[email]`, `contact[first_name]`, `contact[last_name]` and `contact[tags]` for this form type. The mirror also sends `contact[phone]` and `contact[note]`; whether those two are kept is something to check on a test customer.
- The enquiry is also copied to the Vercel `/api/contact` endpoint (Supabase Leads Inbox, monday.com when its token is set); the "Keep me updated" answer travels with it as a plain field.

### Test it yourself (five minutes)

1. Open the preview (the dev server at http://127.0.0.1:9292 while a session is running, or Online Store › Themes › the staging theme › Preview). It talks to the real store, so a test signup creates a real Customer, exactly as the live site would.
2. Scroll to the Journal band and enter an address you control - a plus address such as `naomi+journal-test@sabdia.com.au` keeps it distinct but lands in your inbox. Press Subscribe. You should see "Welcome - you're on the list." (or the hCaptcha page first, then the same message).
3. Shopify admin › **Customers** › search that address › open it. Expect: Email subscription **Subscribed** (or **Pending** if double opt-in is on, with a confirmation email in your inbox), Tags **newsletter**.
4. **Customers › Segments › Email subscribers** - the address is counted there.
5. Optional: repeat from `/products/solace` with another plus address. Expect the extra tag `solace`.
6. Optional, for the consent point above: send an enquiry from `/products/solace` with "Keep me updated" **unticked**. Expect tags `enquiry`, `solace`, the type, with no `newsletter`; then look at what Email subscription says for that person.
7. Delete the test customers afterwards (Customers › the person › the three-dot menu › Delete customer) so the list stays clean.

### Only you can confirm (the site's Admin API token has no customer scopes)

The custom app's token can read and write products, content, pages, navigation and publications only; a read-only check on 11 September 2026 listed exactly those scopes, and a customers query returns "Access denied … Required access: read_customers". So this trace comes from the theme code, the rendered HTML and Shopify's documentation, not from looking at the subscriber list. Things only the admin can settle:

- Whether double opt-in is on (Settings › Notifications, the marketing double opt-in setting). Off means Subscribed straight away; on means Pending until the person confirms.
- How Shopify treats an address that already exists (it should update that Customer and add the tags rather than create a second record).
- Whether an enquiry with the box unticked shows as Subscribed (the consent point above), and whether the phone and note from the mirror are kept.
- The current count in Customers › Segments › Email subscribers, and whether any signups are already there.

## Careers enquiries (14 Sep 2026)

Contact page › enquiry type **Careers**: the buyer questions hide and a CV
field appears (required, PDF or Word, 10 MB). On send the file uploads to
the private Supabase bucket `careers` with the public key, and the enquiry
arrives with the file name in the field "CV". Open the file at Supabase ›
Storage › careers.

**One-off setup (Naomi):** the bucket exists, but the public key needs
permission to add files to it. In Supabase › SQL editor run:

```sql
create policy "careers anon insert" on storage.objects
  for insert to anon with check (bucket_id = 'careers');
```

Until that runs, a Careers enquiry still sends, flagged
"UPLOAD FAILED", and the thank-you asks the applicant to email the CV.

Buyer questions (budget, timeline, locations) on the Contact page appear
only for a specific residence or Request a Viewing; on a residence page
only for Arrange an inspection or Register my interest.
