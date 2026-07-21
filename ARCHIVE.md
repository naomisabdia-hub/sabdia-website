# Archived Features

Features that were built, shipped, and later removed on purpose. Each entry
records why it was removed and exactly how to bring it back — the code lives
on in git history under an `archive/*` tag.

---

## "Walk around QASR" — interactive 3D viewer + first-person walk mode

**Removed:** 22 July 2026 (branch `refine/go-live`)
**Why:** Mo's call — the full 3D model of the residence gave too much away
to the public before sale. Kept here as a worked example in case we ever
want a 3D viewer for a future property or a portfolio piece.

**Git tag with the complete working feature:** `archive/3d-viewer`

### What it was

An "Explore in 3D" section on the property detail page, shown for any
property with `viewer_type` set in the admin:

- **Orbit view** — the property GLB rendered with Google `<model-viewer>`
  (self-hosted): drag to orbit, scroll to zoom, auto-rotate, AR on mobile
  ("view the residence in your own space"), optional labelled hotspots.
- **"Step inside" walk mode** — a code-split three.js first-person viewer
  (WASD / mobile joystick, BVH-accelerated floor-following raycasts so
  stairs worked, Draco-compressed GLB loading).
- **Virtual tour option** — the same section could instead embed a
  Matterport / 360° tour iframe (`viewer_type = 'tour'`).

### Files removed (all restorable from the tag)

| File | Role |
| --- | --- |
| `src/components/PropertyViewer.astro` | The section: markup + lazy model-viewer boot + walk-mode launcher |
| `src/scripts/walkViewer.js` | First-person walk mode (three.js + three-mesh-bvh) |
| `public/js/vendor/model-viewer.min.js` | Self-hosted `<model-viewer>` library (~1 MB) |
| `public/js/vendor/draco/` | Draco decoder for compressed GLBs |

Plus surgical removals inside files that still exist:

- `src/pages/properties/[slug].astro` — import + `<PropertyViewer property={entry} />`
- `public/css/style.css` — all `.viewer-*` rules (the `.sw-*` scroll-walkthrough rules were interleaved and kept)
- `src/lib/db.js` — `viewerType` / `modelUrl` / `posterUrl` / `tourUrl` / `hotspots` row mapping
- `src/lib/admin/schemas.js` — the "3D viewer" select + model/poster/tour fields on the property form
- `src/lib/seed-properties.json` — QASR's `viewer_type: "model"` + model/poster URLs
- `package.json` — `three`, `three-mesh-bvh` dependencies

### The models themselves

The QASR model files (three GLBs + two poster images) originally lived in
public Supabase storage (`media/models/`). On 22 July 2026 they were
**deleted from the bucket** so they are no longer downloadable, and are
archived **privately, outside this repository** (the repo is public while
the site is being built). Ask Naomi for the private archive if a model is
ever needed again — then upload it to Supabase storage and point the
property's model URL at it.

### How to restore

```sh
# See the feature exactly as it shipped
git show archive/3d-viewer:src/components/PropertyViewer.astro

# Bring the deleted files back onto the current branch
git checkout archive/3d-viewer -- \
  src/components/PropertyViewer.astro \
  src/scripts/walkViewer.js \
  public/js/vendor/model-viewer.min.js \
  public/js/vendor/draco

# Then re-add: the three/three-mesh-bvh deps, the <PropertyViewer> usage in
# [slug].astro, the .viewer-* CSS, the db.js mapping and the admin fields —
# the full diff of the removal is:
git show archive/3d-viewer..HEAD -- <path>   # or find the removal commit with
git log --oneline --diff-filter=D -- src/components/PropertyViewer.astro
```

A GLB re-upload (admin → property → 3D model file) is needed afterwards if
the Supabase copies were deleted.
