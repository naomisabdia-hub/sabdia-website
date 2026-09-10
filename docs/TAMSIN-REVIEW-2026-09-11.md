# Tamsin review — everything requested on 10 Sep 2026, and where it stands

Source: four Otter transcripts from 10 Sep (CMS walkthrough, homepage review, page-by-page review, launch planning). The `_2.mp3` is the audio of the fourth transcript (15 min, same meeting), not extra content.

**Preview everything on the staging theme:** https://b91p0j-f4.myshopify.com?preview_theme_id=150783361126 (store password applies). Nothing below is on the live theme until `zsh shopify-app/push-live.sh` is run.

Timeline agreed in the meeting
- **Fri 11 Sep, by 2 pm** — Naomi sends the revised site + reworded copy; Tamsin reviews (she leaves early, physio).
- **Mon 14 Sep** — final tune at lunch; AETHER lists on realestate.com.au ~10 am, socials 6:30 pm; website goes live the same day. Domain move from Wix should start now.
- **Agent Access is parked.** Launch with Home, For Sale, Collection, Services, About.
- Mo has not seen it yet.

Legend: ✅ done on staging · 🟡 built, needs Naomi's content or a tick in Customize · ☐ Naomi in the admin · Mo = decision

---

## 1. Homepage

| # | Request | Status |
|---|---|---|
| 1.1 | Remove "Design, Develop, Construct" title words. SABDIA wordmark alone. | ✅ title words blank; an invisible h1 keeps the page named for search |
| 1.2 | "Boutique Luxury Home Builder & Developer – Brisbane" comes up **after** the wordmark, a smidge bigger. | ✅ Eyebrow size dial (11px now); eyebrow waits for the wordmark |
| 1.3 | "since 2013" line out of the hero; said in About Sabdia instead. | ✅ hero description blank; the sentence opens the About paragraph |
| 1.4 | Slightly darker brand-kit gold. | ☐ parked until Naomi has the hex (Theme settings › Colours) |
| 1.5 | The softened black of "View Properties" everywhere. | ✅ already true: the button, the film band and every dark band share the one Dark colour (#1F1B14) |
| 1.6 | CTA positions fine. | ✅ |
| 1.8 | Stats band a touch smaller. | ✅ Size: Compact |
| 1.9 | Drop "Design · Develop · Construct" from the marquee. | ✅ |
| 1.10 | About hierarchy: heading clearly bigger; "Integrated delivery" etc. as uppercase tracked sub-headings. | ✅ |
| 1.11 | More images in the About strip, carousel feel. | 🟡 Layout = Carousel is on; it glides every Strip image block. Naomi adds more Strip image blocks (2 today) |
| 1.12 | Copy refined via the corpus. | ☐ Naomi, then Tamsin |
| 1.14 | Film band: second video / three images / carousel beside the skinny reel. | 🟡 Built: ⊕ Add block › "Photo beside the reel" or "Second film" (up to 3). Naomi picks the photos |
| 1.15 | Film band margins match the band above. | ✅ |
| 1.18–1.19 | Grid order fine; SIERRA/SOLACE real photos when edits arrive. | ☐ content |
| 1.21 | Real Google review; Trustpilot. | ☐ Naomi (Customize › Home › Testimonial) |
| 1.22 | Agent band hidden for launch. | ✅ |
| 1.24 | Footer: remove the "Design. Develop. Construct." block (the gold italic in the middle). Keep the Journal band and the link columns. | ✅ off (a switch remains in Customize › Footer) |
| 1.25 | Footer columns better centred. | ✅ |
| 1.26 | Remove the sabdiaconstructions.com.au link. | ✅ off (switch in Customize › Footer) |
| 1.27 | Check footer links. | ✅ Agent Access dropped from the fallback list; ☐ Naomi eyeballs the rest |

## 2. For Sale page

| # | Request | Status |
|---|---|---|
| 2.1 | Garage filter needs 2+ and 3+. | ✅ 2+ · 3+ · 4+ · 6+ |
| 2.2 | Same house as hero and as the featured banner. | ✅ hero now shows the second residence (SIERRA); AETHER is the banner |
| 2.3 | Mash-up film in the header. | 🟡 "Hero film" upload/URL is ready; Naomi cuts the film from real footage |
| 2.4 | Order: AETHER, then SIERRA, SOLACE, CASPIAN. | ✅ done in the For Sale collection; QASR sits fifth (confirm with Tamsin) |
| 2.5 | Remove the "Sold Prior to Completion" band. | ✅ off by default (switch: Customize › For Sale › "Show the sold band") |
| 2.6 | "Request a viewing" as an enquiry option. | ✅ the button opens Contact with "Request a Viewing" selected. ☐ Naomi may also add it as an Interest block (Customize › Contact › ⊕ Add block) so it is always in the list |

## 3. Residence pages

| # | Request | Status |
|---|---|---|
| 3.1 | Brochure font for each residence's name. | 🟡 Built per residence: Customize › the residence's template › Property page › "Residence name font" — type a Google Fonts family (e.g. Cinzel, Inter) or paste the brochure font file from Content › Files; size, spacing and capitals dials. QASR's brochure PDF has no embedded font to extract, SOLACE's uses Pirulen (display), DIN Next and Open Sans — Naomi confirms the faces |
| 3.4 | Which photos show — Mo's call; Instagram rule as default. | Mo |
| 3.5 | Walkthrough toggle, only on live houses. | ✅ exists (Products › Show the scroll walkthrough); Mo |
| 3.6 | Walkthrough room list more pronounced. | ✅ labelled "Jump to a room" rail, larger buttons, current room lit gold |
| 3.8 | Series tiles open the Instagram post. | ✅ default already "Open the post on Instagram"; retest on the phone |
| 3.9 | SABDIA always capitals in captions. | ✅ |
| 3.10 | Block at the bottom = the footer "Design Develop" band. | ✅ removed (1.24) |

## 4. Collection — rebuilt

| # | Request | Status |
|---|---|---|
| 4.1 | Least polished page → make it stunning. | ✅ new editorial grid: wide and portrait tiles alternate, films on hover, name in the display serif, suburb · style · year under each |
| 4.2 | Past projects laid out like a For Sale house, no enquiry flow, a "similar residences" row, unique per house. | ✅ new page: photographic hero (facade), specs bar (location · style · completed · beds · baths · garages · land, only what is filled), story beside two offset editorial photos, stage + filmstrip gallery, a five-photo details mosaic, the film, **Similar residences** (same style first, then same suburb), then a quiet "See what is for sale now" band with a share row. No form anywhere |
| 4.3 | Hero banner. | ✅ HERMOSA facade as the banner (Customize › Collection › Page header › Banner to change; a film can go there too) |
| 4.4 | Remove For Sale / Sold / Completed buttons; for-sale homes out. | ✅ the page shows completed residences only |
| 4.5 | Style categories. | 🟡 filter chips read each page's **Style** field. Pre-filled from captions/photos for Tamsin to confirm: MILOS, AMMOS, CALLE, ELYSIUM, ALHAMBRA, HERMOSA = Mediterranean · ENCANTO = Palm Springs · FRASER = Hamptons · PETRA, KIRRA = Contemporary · NERO = blank. Suburb dropdown too |
| 4.6 | Tiles bigger, scroll effect kept. | ✅ |
| — | Per-house facts. | 🟡 New page fields (Content › Pages › the residence › Metafields): Style, Completed (year), Bedrooms, Bathrooms, Garages, Land size, Headline, Story, Key features. Years pre-filled for MILOS/AMMOS/ELYSIUM (2025) and CALLE (2026) from the Instagram dates — confirm. Numbers are empty until Naomi fills them; the bar simply shows what exists |
| — | NERO | ☐ has no photos of its own and no film (its old hero was a HERMOSA photo). Needs a photo set before it looks like the others |
| — | MILOS / AMMOS / ELYSIUM heroes | ✅ switched from the portrait reel posters to real facade photos |

## 5. Services

| # | Request | Status |
|---|---|---|
| 5.1 | "What We Offer" → "Our Process"; in-house language. | ✅ hero now "How We Work / Our Process"; intro label "In-House, End to End". ☐ Naomi rewrites the body copy (Customize › Services › the four stages) |
| 5.2 | Video behind the hero. | 🟡 "Hero film" upload/URL added to the page hero; Naomi picks the film |
| 5.3 | Banner heights consistent. | ✅ About, Services and the Collection banner share one height setting (Standard) |
| 5.4 | Portrait images, a video per stage. | ☐ content; the stage blocks take an image each |
| 5.6 | Remove "Have a site or an idea?". | ✅ hidden |

## 6. About

| # | Request | Status |
|---|---|---|
| 6.1 | Actual logo in the hero. | 🟡 tick "Show the Sabdia wordmark in place of the title" (Customize › About › Page hero) |
| 6.2 | Remove "Ten years of building". | ✅ now "Designed and built in-house, in inner Brisbane, since 2013." |
| 6.4 | Timeline column should hold while you scroll. | ✅ |
| 6.5 | Verify awards; remove display-home ones. | ☐ Naomi (Customize › About › Awards, remove a block) |
| 6.6 | "Ready to talk about your home?" → push to what's for sale. | ✅ "See what is for sale now." |

## 7. Agent Access (parked)

| # | Request | Status |
|---|---|---|
| 7.1 | Off for launch. | ✅ home band hidden, nav/footer fallbacks cleaned. ☐ **Naomi: Content › Menus › Main menu › remove "Agent Access"** (the API would not let me), and Content › Pages › Agent Access › hide if you want the URL gone |
| 7.2 | Three benefits, select-agents wording. | ✅ ready in the template (Pre-Release Access, Floor Plans & Brochures, Private Walkthroughs) |
| 7.5 | Portal / DocSend pricing. | Mo, later |

## 8. Find Your Home — Mo's yes/no. Toggle exists.

## 9. CMS, enquiries, chat

| # | Request | Status |
|---|---|---|
| 9.1 | Photo picker on every image field. | ✅ audited: every image URL field already has a picker beside it |
| 9.4 | Pre-tick "Keep me updated". | ✅ already ticked by default |
| 9.5–9.6 | Inbox instant answers, $0.00 cards. | ☐ Shopify Inbox admin: answers with links, not product cards |
| 9.7 | Meta/alt pass. | ✅ alt text on every new image; ☐ per-page meta descriptions are Naomi's words |

## 10. Tracking, launch, domain

| # | Request | Status |
|---|---|---|
| 10.1 | Pixel + Google tag, cookie banner. | ☐ admin (LAUNCH-CHECKLIST.md) |
| 10.3 | Password page film + wordmark, no default text. | 🟡 built: Customize › Password page › pick the film/photo; wordmark on by default |
| 10.4 | Domain move from Wix. | ☐ start now (LAUNCH-CHECKLIST.md §16–18) |
| 10.5 | AETHER → realestate.com.au link. | ☐ Monday, Products › AETHER › Brochure/links |
| 10.7 | Copy rewrite. | ☐ Naomi, then Tamsin |

---

## Naomi — before Tamsin at 2 pm (in order)

1. Open the staging preview and click through Home, For Sale, Collection, CALLE / MILOS, Services, About.
2. **Content › Menus › Main menu** → remove Agent Access.
3. **Customize › Home › About** → add three or four more Strip image blocks (the carousel).
4. **Customize › Home › Film band** → ⊕ Add block: two photos (or a second film) beside the reel.
5. **Customize › Password page** → pick the film.
6. **Content › Pages › each Collection residence › Metafields** → confirm Style, add bedrooms/bathrooms/garages/land/year where known. NERO needs photos.
7. Copy pass (Services stages, About, testimonial, awards).
8. When happy: `zsh shopify-app/push-live.sh` — pushes the code and these template edits to the live theme.

## For Mo
1. Find Your Home module — on or off.
2. Which photos per residence (Instagram rule as default).
3. Scroll walkthrough on live houses.
4. Agent portal scope and DocSend/PandaDoc budget (later).
