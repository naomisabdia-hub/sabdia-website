# Instagram → The Series (automatic)

Every residence page on Shopify has a "The story of …" strip. This sync
keeps it filled from the @_sabdia Instagram account on its own: each
morning it reads the latest posts, works out which house each one is
about, copies the reel or carousel onto Shopify Files (so it never
expires), and writes it into that residence's **The Series posts**
metafield — the same metafield the theme already renders. Nothing is
generated; only media Sabdia has already published is copied.

On the page, a tile either **plays here on the site** (reel in the player,
carousel as slides, with a "View on Instagram" link) or **opens the post on
Instagram** — Theme editor → the property page → *The Series* section →
*Reels and carousels*.

## One-time setup (about 15 minutes, Naomi)

### 1. Let the Shopify app write to Files

Shopify admin → **Settings → Apps and sales channels → Develop apps** →
the Sabdia app → **Configuration** → *Admin API integration* → **Edit** →
tick **read_files** and **write_files** → **Save**. If Shopify shows a new
Admin API access token afterwards, put it in `.env` as
`SHOPIFY_ADMIN_TOKEN` (and in the GitHub secret below).

### 2. Get an Instagram access token

The @_sabdia account must be a **Business** or **Creator** account
(Instagram → Settings → Account type). Then:

1. Go to <https://developers.facebook.com/apps/> and **Create app** →
   type **Business** → name it "Sabdia website". (Sign in with the
   Facebook account that manages the Sabdia page, or any account you
   control — it only holds the app.)
2. In the app, left menu → **Instagram → API setup with Instagram business
   login**.
3. Under *Generate access tokens*, **Add account** → log in as @_sabdia →
   accept. Then **Generate token** next to the account → log in again →
   copy the token. It is a long-lived token (60 days). The sync refreshes
   it automatically before it expires, so this is normally done once.

Keep the token private — it lets anyone read the account's posts.

### 3. Give the sync its keys

Local (to run by hand): add to `.env`

```
INSTAGRAM_ACCESS_TOKEN=<the token from step 2>
```

GitHub (to run every morning): repo → **Settings → Secrets and variables →
Actions → New repository secret**, three of them:

| Secret | Value |
| --- | --- |
| `SHOPIFY_STORE` | `b91p0j-f4.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | the app's Admin API access token |
| `INSTAGRAM_ACCESS_TOKEN` | the token from step 2 |

### 4. First run

```bash
npm run sync:instagram:check
```

That confirms the scopes and the token without writing anything. Then:

```bash
node shopify-app/sync-instagram.mjs --dry-run
```

shows which posts matched which residence. When it looks right:

```bash
npm run sync:instagram
```

The first run copies every matched reel and carousel to Shopify Files, so
it can take several minutes. After that it runs every morning at 6:00
Brisbane via GitHub Actions (**Actions → Instagram → The Series**, where
*Run workflow* triggers it on demand). The theme change (the on-site
player for reels and carousels) goes live with the next theme push.

## What is pulled

Feed posts only: **reels, carousels and single photos**. Stories are never
included (Instagram keeps them off the posts feed, and they vanish after
24 hours). To leave single photos out, set `SERIES_TYPES` to `REEL,CAROUSEL`
in the workflow file (`.github/workflows/instagram-series.yml`) or in `.env`.

## How posts are matched to a house

A post belongs to a residence when its caption contains:

- the residence name as a whole word — `AETHER`, `Aether`, `at AETHER,`
- a hashtag starting with the name — `#aether`, `#aetherbysabdia`
- or, if the residence has **Series keywords** set (a metafield on the
  product / Collection page in the Shopify admin), any of those words or
  #hashtags instead of the name.

Use *Series keywords* when a name is too common to trust (put the exact
hashtags you use for that house), or put a single `-` to switch matching
off for that residence. A post that names two houses appears on both.

## Editing what the sync produced

- **Hide a post**: product → Metafields → *The Series posts* → find the
  entry and add `"hidden": true`. It stays hidden on later syncs (deleting
  the entry would only bring it back the next morning).
- **Hand-added posts** (entries without an `id`) are left exactly as they
  are and sort into the strip by their `date`.
- Captions and links always follow Instagram — edit the post there.
- A post deleted on Instagram drops out of the strip on the next run.
- Collection pages stitch their editorial story from the three strongest
  captions, so a new long caption can change that paragraph too.

## Where things live

| What | Where |
| --- | --- |
| Sync script | `shopify-app/sync-instagram.mjs` |
| Schedule | `.github/workflows/instagram-series.yml` |
| Posts per residence | product / page metafield `custom.series_posts` |
| Keywords per residence | metafield `custom.series_tags` ("Series keywords") |
| Copied images and reels | Shopify admin → Content → Files (`series-<house>-<post id>…`) |
| Instagram token (refreshed copy) and last-run report | private shop metafields, namespace `$app:instagram` — not visible to visitors |
| The strip itself | `shopify-theme/sections/series-strip.liquid` |

## If it stops

- *"missing the write_files scope"* → step 1 was not completed.
- *"Instagram token expired"* → the sync did not run for 60+ days (a token
  cannot be refreshed once it has lapsed). Repeat step 2 and update the
  `INSTAGRAM_ACCESS_TOKEN` secret; the next run picks it up.
- *"Instagram: … code 190"* → the token was revoked (password change,
  account type change). Same fix as above.
- Files "still processing" → a large reel was still transcoding when the
  run ended; it is picked up automatically next morning.
