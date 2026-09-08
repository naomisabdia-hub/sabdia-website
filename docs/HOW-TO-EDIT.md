# How to edit the Sabdia site (Shopify) — one page

Admin: `admin.shopify.com/store/b91p0j-f4` · Site: `b91p0j-f4.myshopify.com` (password under Online Store › Preferences).
The full illustrated guide is *Sabdia Website Guide.pdf* on the Desktop.

| I want to change… | Go to | Notes |
|---|---|---|
| Words, pictures, films on a page | **Online Store › Themes › Customize** | Pick the page in the top-centre dropdown first |
| Home banner: slideshow or a film | Customize › Home › **Hero slideshow** › Header media | Set "Show" to **Video instead**, upload the mp4. Slides are kept — set it back to Slideshow any time |
| Size, shape or crop of a photo | Customize › click the section › **Size** | Image band, Photo gallery and Page hero: shape (4:3, square, portrait…) or fixed height, band width, gap; each image block has **Crop focus** and Image band a **Zoom**. Shopify has no drag-to-resize — these settings are the resize |
| Size of the two About photos | Customize › Home › **About** › Image strip | Layout (2:1, equal, 1:2, single), height, phone height, gap; each Strip image block has a crop focus |
| "Privacy Policy" link under forms | Theme settings › Site plumbing › **Privacy link beside forms** | Appears after every enquiry note automatically; blank it to hide |
| Password page (store locked) | Customize › pick **Password** page in the dropdown | Section "Password page": heading, text, button |
| Form labels, button text, filter names, small labels | Customize › click the section › **Wording** | Every visible word is a setting; card chips are under Theme settings › **Labels** |
| A residence (QASR, SOLACE…) | **Products** › the residence | Media: first image = hero, next six = gallery. Numbers and **Status** live under **Metafields** at the bottom |
| **Move a house between For Sale / Under Offer / Coming Soon / Sold** | Products › the residence › **Status** (bottom of the page) › Save | One dropdown, the whole site follows: cards, chips, the For Sale and Sold lists, the Projects page, the enquiry form (hidden when sold). A sale fell through? Set AETHER back to **For Sale**. Add a new wording (e.g. "Sold Off Market") at Settings › Custom data › Products › Status — anything containing "Sold" goes in the Sold group |
| Take a house off the site entirely | Products › the residence › Product status (top right) › **Draft** | Comes back with **Active**. Nothing else to touch |
| **Add a new For Sale / Sold residence** | Products › open a similar residence › ⋯ **Duplicate** (tick "Copy product media" only if the photos are the same) | The copy carries the description and every field at the bottom (Status, suburb, beds, baths, garages, land, features, enquiry text, film, walkthrough…). Rename it, swap the photos (first = hero, next six = gallery), correct the fields, set **Status**, Save. One product page template is shared by every residence, so it looks like the others straight away. Starting from **Add product** works too — the same fields appear, just empty |
| **Add a completed residence to the Collection** | 1. Content › Pages › **Add page** › Theme template **collection-item** › fill the fields at the bottom (Location line, Hero image URL, Film video URL). 2. Customize › Collection › Portfolio grid › **⊕ Add block › Residence** › pick that page | The card's name, location, photo, film and link fill in from the page. Drag the block to order it. Sold houses already appear on the Collection page by themselves |
| Scroll-to-move walkthrough on a residence | Products › the residence › Metafields › **Show the scroll walkthrough** (and **Scroll walkthrough folder**) | Off, or an empty folder, hides it for that residence. Only the residences that have real frame sets get one |
| Build size filter on For Sale | Products › the residence › Metafields › **Build size (m²)** | The filter appears once any residence has a number. Filters now: Suburb, Garage, Land size, Build size, Sort |
| Home film: words clash with the film's own SABDIA | Customize › Home › **Hero slideshow** › *Hold the words back*, *Show the SABDIA wordmark*, *Wordmark fades in after* (0-60 s) | With *Fade out at the end of the film and replay with it* on, the words and wordmark fade in at their second, fade out just before the film ends, and come back with every loop |
| Fonts | Theme settings › **Design** › *Body and interface font* | Two typefaces only: the large headings stay in Cormorant Garamond; everything else is this font (Open Sans by default) |
| Text sizes (hierarchy) | Theme code: the **Type scale** block at the top of `style.css` | One set of roles for the whole site - display, h1, h2, h3, lead, body, small, label, micro. Every section uses these, so a size changes everywhere at once. Ask for a code change to adjust |
| Dashes | Nowhere - the site uses plain hyphens, never the long dash | Type - with a space either side when you write copy |
| The Collection page | Customize › Collection › **Portfolio grid** | Shows the For Sale and Sold residences first (from Products), then the completed Residence blocks, with an All / For Sale / Sold / Completed filter. Both switchable. Projects is no longer in the menu; its old address redirects here |
| A sideways photo slideshow (carousel) on any page | Customize › **+ Add section › Photo gallery** › Structure: **Carousel** | Arrows, swipe, optional auto-advance and photo width under the Carousel header. Any page, as many as you like |
| The Series (Instagram strip on a residence) | Runs itself — posts arrive from @_sabdia each morning | Name or #hashtag the house in the caption. Play on site vs open on Instagram: Customize › the residence › **The Series**. Hide a post or add keywords: `docs/INSTAGRAM-SERIES.md` |
| For Sale / Sold order | Products › **Collections** › For Sale / Sold | Sort "Manually", drag. The first For Sale residence is the big card on the home page and the banner on /collections/for-sale. (Which list a house is in is its **Status**, not the collection) |
| The Journal | **Content › Blog posts** | Blog "The Journal"; featured image + excerpt matter |
| Nav and footer links | **Content › Menus** | Main menu; Company and Legal menus for the footer |
| Privacy / Terms / Accessibility text | **Content › Pages** | The page body is the text. Other pages keep their words in the customizer |
| Logo, logo size, ABN, QBCC number, phone, email, socials | Customize › **Theme settings** (bottom-left) › Brand / Contact / Social | |
| Colours | Theme settings › **Design** › switch on "Use the colours below" | Off = built-in palette |
| Share image, Google description | Theme settings › **Search & sharing** | |
| Your photo library | **Content › Files** | Drag folders in; every picker's "Select image" browses it |
| A set of photos on any page | Customize › **+ Add section › Photo gallery** | Up to 50; two/three/four-across or editorial |
| Where enquiries go | Theme settings › Site plumbing › **Enquiry handling** | Sabdia API (Leads Inbox) or Shopify (email + Customers) |

## The three things that confuse everyone

1. **Pictures are inside blocks.** Click the small triangle beside a section, then the block (Slide 1, Image, Residence, Photo). The picker is there.
2. **A picker that says "Select image" while a photo shows.** The photo is coming from the field under it, *Current photo (URL)*. Pick an image; it takes over. Ignore the URL field.
3. **Residence photos are not in the customizer.** They are on the product: Products › the residence › Media.

## Changing the design

- **Layout of a page** — drag sections, eye icon to hide, + Add section. No code.
- **Colours, logo, labels, wording** — Theme settings. No code.
- **Fonts, spacing, animation, new kinds of section** — the theme code in the project (`shopify-theme/` and the shared `style.css`). Brief → Claude Code session or developer → pushed to the **staging** theme → you preview → you publish. Never use Online Store › Themes › Edit code (the next push overwrites it), and decline Sidekick's offers to "build" sections.

## Publishing a code change safely

1. Online Store › Themes › **Sabdia** › ⋯ › **Duplicate** (an exact copy, settings included).
2. Tell Claude the copy's name; code is pushed to the copy, never to the live theme.
3. Preview the copy (⋯ › Preview), check on your phone.
4. ⋯ › **Publish**. The previous theme stays in the list as a rollback.
