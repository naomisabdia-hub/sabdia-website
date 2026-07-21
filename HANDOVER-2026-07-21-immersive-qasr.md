# Session Handover — QASR Immersive Suite (2026-07-20 → 21)

Summary of the full working session with Claude. Read this at the start of a
new session to continue where we left off. Everything below is **live on
production** (https://sabdia-website.vercel.app) unless marked pending.

---

## What was built this session

### 1. AI build time-lapse film (QASR)
- Generated with Higgsfield MCP → **Seedance 2.0**, using the real QASR facade
  render as `end_image`; 12s / 1080p / 16:9 / silent. Cost: **108 credits**.
- Hosted: Supabase storage `media/films/`. Plays in the **journey scrub
  slider** on `/projects/`.
- Recipe notes (for SOLACE/CASPIAN/SIERRA later) are in memory + PROGRESS.md:
  import facade via `media_import_url`, fixed-camera time-lapse prompt,
  upload with `apikey: sb_secret_…` header (NOT Bearer).

### 2. Cinematic chaptered walkthrough (QASR property page)
- Source: Muhammad's Dropbox "25.10.13 Full set Videos" — 16 clips, 6.3GB 4K
  portrait renders. All downloaded; 9 curated into a narrative arc:
  **Arrival → Motor Court → Entry Void → Lounge → Fireside → The Bar →
  Dining → Pool Courtyard → Dusk**.
- Encoded 810×1440 H264 CRF23 ≈ **39MB total**; hosted in Supabase
  `media/walkthrough/qasr/web-clipXX.mp4`.
- Component: `src/components/WalkthroughCinema.astro` — 9:16 cinema frame,
  numbered chapter rail with per-chapter progress line, auto-advance,
  lazy-load. Data lives in `src/pages/properties/[slug].astro`
  (`walkthroughs` map, keyed by slug — add other properties there).
- Bug fixed post-launch: frame collapsed to zero width (`margin:0 auto` on a
  flex-column child + absolutely-positioned video). Fix: explicit width
  `min(100%, calc(min(76vh,680px)*0.5625))`.

### 3. Interim 3D model ("Walk around QASR" orbit/AR viewer)
- The real SketchUp model (`Buena Vista extra steps.skp`, 620MB, from
  Muhammad's Dropbox) **cannot be converted on this Mac** — the only
  Blender SKP importer ships Windows-only binaries. Blender 5.2 LTS is
  installed at /Applications for when a usable format arrives.
- **Interim model recipe that worked (32 credits):** three clip frames →
  `nano_banana_2` image-to-image → clean aerial isometric diorama render
  (2 credits) → `image_to_3d` textured (30 credits) → gltf-transform
  optimize (draco+webp, 9.5MB → 1.4MB).
- Failed first attempt (30 credits, lesson learned): multi_image_to_3d on
  ground-level shots → useless planter-box blob. Don't feed street shots.
- Hosted: Supabase `media/models/qasr-maquette.glb` (+ poster jpg).
  QASR row in Supabase `properties` table: `viewer_type='model'`,
  `model_url`/`poster_url` set. Seed JSON matches.
- **Caveat:** rear elevation is AI-guessed; presents as a stylized maquette.
  When the real GLB arrives: upload to same bucket, update `model_url` in
  the properties table — no code change needed.

### 4. Adaptive editorial gallery + enquiry polish (parallel session's work)
- `cleanGalleries()` in `src/lib/db.js` dedupes padded CMS galleries by Wix
  media ID; gallery grid adapts to photo count (`gn-N` classes).
- Property page section order now: About → Gallery → Film → 3D Viewer →
  Walkthrough → Series → closing enquiry CTA → Related. Sticky enquire bar.
- Contact + agent-access pages refreshed (guided-match cross-link, info block).

## Git state
- Repo: `naomisabdia-hub/sabdia-website` (private). Branch `refine/go-live`
  work merged to `main`; deploys are **CLI-driven** (`vercel deploy --prod`),
  pushes do NOT auto-deploy.
- Tags: `v3.1.0`, `v3.1-elevation`, `v3.2-showpiece`, **`v3.3-immersive`**
  (= journey film + walkthrough + 3D maquette + match wizard).
- At session end: the parallel session's newest edits (gallery data layer,
  contact/about/collection polish) were **deployed to production but may
  still be uncommitted** — run `git status`; if dirty, commit that work
  before anything else.

## Media inventory (local, session scratchpad — will be purged)
Source 4K clips + the 620MB .skp were in the session scratchpad and are
gone when the session dies. Re-download from Muhammad's Dropbox links if
ever needed; the web-encoded deliverables are safe in Supabase.

## Higgsfield credits
~**782 remaining** (spent this session: 108 film + 62 3D attempts/success).

## Pending / parked (in priority order)
1. **Real GLB from Muhammad** — ask: SketchUp Pro → File → Export →
   3D Model → **GLB** (or FBX/OBJ/DAE; Blender converts those locally free).
   Then: optimize with `npx @gltf-transform/cli optimize in.glb out.glb
   --compress draco --texture-compress webp --texture-size 2048`, upload,
   PATCH `properties.model_url`.
2. **Films + walkthroughs for SOLACE / CASPIAN / SIERRA** — same recipes as
   above. Buildertrend has real progress photos (57 daily logs on
   96 Waverley Rd = SOLACE) via Naomi's Chrome login.
3. **Wix image migration** — all property images still hotlink
   `static.wixstatic.com`; must move to Supabase before cancelling Wix.
4. **Domain cutover** — www.sabdiaconstructions.com.au still points at Wix.
5. Consider Vercel↔GitHub integration so pushes auto-deploy.

## Gotchas for the next session
- `.env` has a quoting issue — grep values out, don't `source` it.
  Supabase storage REST wants `apikey: sb_secret_…` (new-style key).
- The in-app Browser pane can't scroll this site programmatically and
  screenshots freeze after first paint — verify layout with
  `getBoundingClientRect` via javascript_tool, render GLBs via Blender.
- Dropbox folder zips fail mid-download; harvest per-file links from the
  folder page (`a[href*=".mp4"]`) and download individually with retry.
- n8n is NOT in the company stack (build prompt is wrong about that).
- Heston/Veridicus no longer engaged — everything is Naomi/company-owned.
