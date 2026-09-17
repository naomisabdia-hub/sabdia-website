# The site chat - Shopify Inbox's AI agent (since 15 September 2026)

**Ask Sabdia is archived.** Naomi, 15 Sep 2026: the site chat is now Shopify Inbox with its AI **Agent** switched on (Inbox › Chat settings › Agent). The residences for sale are pages and every product is Draft, so Inbox has no $0 product to show.

- **The agent's rules** live in Inbox › Agent › Persona, pasted at the end of the existing text as "Sabdia Rules": an AI note in the first reply (some information may not be accurate), no pricing ("We don't disclose pricing unless it has been discussed with our Director"), collect name, email, phone, residence, budget, timeline and suburbs one or two at a time or point to /pages/contact, name the residence being enquired about, only website facts, the client-builds reply, Sabdia voice.
- **Open homes, auctions and what can be bought** (since 17 Sep 2026): the agent reads published pages, so these facts live on one page, **Content › Pages › Open homes & availability** (`/pages/inspections`, not in the menu). Each residence for sale has its own heading with Open homes, Auction and Selling agent; add a time as a new bullet, delete it once it has passed. The top of the page says which residences can be bought (the For Sale list) and which cannot (sold prior to completion, sold off market, The Collection). `shopify-app/create-inspections-page.py` created it and only ever creates it when it is missing; `--show` prints the live text. The Persona carries a matching "Open homes and buying" rule: use only that page, never offer a time that has passed, and offer a private inspection when no time is listed. Shopify's own guidance is to keep facts out of the Persona, so times go on the page, never in the Persona.
- **Common questions** (17 Sep 2026): the agent told a visitor a sold home might return if "withdrawn, repriced or otherwise becomes available", because no page answered it. The same page now ends with straight answers: what Sold means, what The Collection is, sold homes do not come back, what is available, pricing, talking to a person. `create-inspections-page.py --add-questions` appended them (only when the heading is missing).
- **The whole Persona, replaced** (17 Sep 2026). Shopify REJECTS facts and rules in the Persona ("Personas can only shape your agent's voice and tone"), so the first draft (pricing line, open homes page, what can be bought) would not save. Facts live on /pages/inspections and in Apps › Knowledge Base; the Persona is voice and service style only, in the shape Shopify already accepted (Role & Core Identity + principles):

  > **Role & Core Identity**
  > You are the voice of Sabdia online: calm, warm, polished and brief. You speak like a knowledgeable member of a boutique Brisbane studio that designs and builds luxury homes. Quietly confident, precise, never pushy.
  >
  > **Tone**
  > Brief: two or three short sentences per reply.
  > Plain Australian English, understated and warm.
  > No exclamation marks, emojis, long dashes, superlatives or sales phrases.
  > Refer to homes as residences.
  >
  > **Customer-First Principles**
  > Lead with the answer: answer only what was asked, then stop.
  > Stay close to our own words: repeat what our pages say rather than adding your own explanation.
  > Don't speculate: if you're not certain, say our team can confirm it rather than guessing or listing possibilities.
  > Ask, don't assume: one focused question at a time.
  > Offer a next step: an open home, a private inspection or a conversation with our team.
  > Humans, not sales targets: never upsell or push.
  > Warm hand-over: when someone asks for a person, reply in one friendly line and let our team take over.
  > Open about being AI: in your first reply, mention lightly that you're an AI assistant and our team can confirm details.
- **Customers:** Inbox › Chat settings › Collect customer details files name and email in Customers. Budget, timeline and residence stay in the conversation; they are not added as customer tags the way Ask Sabdia did.
- **Pricing is instruction, not a lock.** Read Inbox › View conversations now and then for any reply that strays.
- **Ask Sabdia is kept, not deleted:** `sections/concierge.liquid`, its Sabdia replies in Customize and its style.css rules are all still in the theme. `layout/theme.liquid` no longer renders it; to bring it back, put `{% section 'concierge' %}` back there inside an `unless locked`, and style.css hides the Inbox bubble again automatically.

Everything below describes Ask Sabdia as it worked from 11 to 15 September 2026.

---

# The site chat ("Ask Sabdia") - how it works, in plain English

Since 11 September 2026 the small **Ask Sabdia** button in the bottom corner of every page is Sabdia's own chat. Shopify Inbox is still installed, but it is only the hand-over: its bubble stays hidden until a visitor presses **Chat with a person**.

## What the chat is

- A scripted concierge. Every reply is one of three things: a **Chat answer** you wrote, a **fact from Products** (name, suburb, bedrooms, bathrooms, garage, land, headline, key features - never the price), or a **step of the enquiry** (name, email, phone, residence, budget range, timeline, locations, message).
- **It never uses AI.** There is no model behind it, nothing is generated, and it cannot say anything you have not written or that is not on a Product. If a question has no answer it says so and offers to take the visitor's details or hand over to a person.
- **It never shows a price.** The price is not passed to the chat at all, and on top of that the chat strips any currency amount (a "$0", "$0.00", "AUD 0" or any "$" figure) from every reply before it is shown. The only money that ever appears is the **budget range the visitor chooses** from the chips, echoed back as their own message. Those chips are ranges for the visitor to pick from, never a statement from Sabdia.
- A question about the price of a residence ("how much is SIERRA") is answered with the pricing reply first (pricing is discussed directly, no guide is published) and then the offer to leave details. It never jumps straight into the form.
- Naming a residence ("tell me about SOLACE") answers with that home's live facts from Products and offers **Enquire** or **Request a viewing**.
- Viewing questions ("book a viewing", "can I inspect", "visit") set the enquiry type **Request a Viewing**, the same wording as the contact page's interest list, so it is tagged and filtered the same way.

## Where every answer lives

**Online Store › Themes › Customize › any page › scroll to the bottom › Sabdia replies.**

- **Chat answer** blocks are the answers. Each has a category (About Sabdia / Our residences / Buying and inspections / Client builds and renovations / Agents / Something else), the question as it appears on the button, the words that match it when typed, the answer, and "Then…": leave empty for nothing, a page path such as `/pages/agent-access` to offer a link, or the word `enquire` to start the enquiry steps.
- 39 answers ship as the defaults. Edit any of them, add more with ⊕ Add block, or delete one. Keep answers under 350 characters so the same text can be pasted into Inbox.
- Rules for writing one: Sabdia voice (restrained, declarative, no exclamation marks, no superlatives, "residence" not "property", no long dashes), never a price or a hint of one (say pricing is discussed directly and use `enquire`), and never a promise you cannot keep. For finance, deposits, overseas buyers and anything with a policy behind it, the answer is that the team will talk it through - then `enquire`.
- Also on that panel: the greeting, the chat subtitle, the wording when nothing matches, the thank-you after an enquiry, the budget and timeline chips (one per line), and how the chat opens (categories first, or the first questions directly).
- **Form thank-you** blocks on the same panel are separate: they are what the page forms show after sending. They do not affect the chat.
- Residence facts are not on this panel: Products › the residence › Metafields (suburb, bedrooms, bathrooms, garages, land, headline, key features) and Status.

## How the in-chat enquiry lands

The chat asks for the details one at a time and then sends them through the same Shopify contact form as every other form on the site. Nothing new to set up.

- **Email** to the store's sender address (Settings › Notifications › Sender email), with First name, Last name, Email, Phone, Enquiry type, Property, Budget range, Timeline, Preferred locations, Keep me updated, the message, and Source: "Concierge chat".
- **Customers**: the person is created or updated and tagged `enquiry`, the residence (`sierra`), the enquiry type (`request-a-viewing`, `register-interest`, `request-price-guide`, `upcoming-releases`, `general-enquiry`, `agent-access`), `budget-…`, `timeline-…` and `loc-…`. The message and date go on the customer's note. Build lists at Customers › Segments (for example `customer_tags CONTAINS 'request-a-viewing'`).
- The visitor sees "Thank you, <first name>. A member of our team will be in touch with you as soon as possible." If Shopify insists on its spam check page, the visitor is taken there and returned to the site with the thank-you shown in the chat.
- Typing `cancel`, `stop` or `back` during the steps abandons the enquiry and returns to the topics.

## Shopify Inbox: stop the "$0" product cards

Inbox showed a visitor "SIERRA price $0" because its product suggestions read the store's products, and every residence is a $0 product. Inbox is now only the hand-over, but do this once so it can never happen again:

1. **Apps › Inbox › Settings** (or Chat settings): turn **off** suggested replies, AI-assisted or automated replies, and **product suggestions / product recommendations**. If your Inbox version offers "Shop app" or "Shopify Magic" replies, turn those off too.
2. **Never share a product card** from an Inbox conversation - the card carries the price. Send the residence page link as plain text instead (`/products/sierra`).
3. Use **Instant answers** with links for the common questions. The wording is in `docs/INBOX-ANSWERS.md`, kept to the same answers as the chat and under Inbox's 350-character limit.
4. **Inventory to zero** (LAUNCH-CHECKLIST.md item 7): Products › each residence › Inventory: Track quantity on, Available 0, "Continue selling when out of stock" off. This closes the checkout door and stops Inbox treating a residence as something to sell.
5. Leave **Collect customer details** on, so a hand-over chat still gives you a name and email.

## Testing it

Open any page, press **Ask Sabdia**, and try: "how much is SIERRA" (pricing reply, then Leave my details), "book a viewing" (viewing reply, then the steps), "tell me about SOLACE" (live facts), "can you build my house" (client builds reply), "asdfgh" (the nothing-matches reply). Send a real test enquiry once and check the email and Customers.
