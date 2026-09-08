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
| A residence (QASR, SOLACE…) | **Products** › the residence | Media: first image = hero, next six = gallery. Tag `sold` to move it to Sold. Numbers live under **Metafields** at the bottom |
| The Series (Instagram strip on a residence) | Runs itself — posts arrive from @_sabdia each morning | Name or #hashtag the house in the caption. Play on site vs open on Instagram: Customize › the residence › **The Series**. Hide a post or add keywords: `docs/INSTAGRAM-SERIES.md` |
| For Sale / Sold order | Products › **Collections** › for-sale / sold | Sort "Manually", drag |
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
