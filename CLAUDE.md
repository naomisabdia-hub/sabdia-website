# Sabdia Website — Project Rules

## ⛔ ABSOLUTE RULE: never AI-generate the houses

**No AI-generated imagery or video may depict any Sabdia property's
architecture, layout, interiors, or finishes. No exceptions.**

- This applies to EVERY property (QASR, SOLACE, SIERRA, CASPIAN, …) and
  every surface: walkthroughs, films, galleries, posters, social content.
- "Anchored" generation (real start + end frames) is **still forbidden** —
  the generated middle invents architecture. This was tried twice for QASR
  and both times it fabricated stairs/doors that don't exist. Naomi had to
  correct it three times.
- Marketing that shows fictional architecture misleads buyers and damages
  Sabdia's credibility.
- The ONLY sources of truth for how a property looks are the visualiser's
  (Muhammad's) real renders, clips, and photos, plus the plans/models.
- For missing transitions in film cuts: use **reversed real footage**
  (a real stair descent played backwards is a real ascent — scroll-scrub
  is direction-agnostic) or a **plain crossfade**. Nothing else.
- Reversal grammar (Naomi, 2026-07-22): reversed footage is only OK where
  direction is ambiguous — stairs, lateral pans. Never reverse a walk
  through rooms: it plays as walking backwards. A return leg must be a
  real forward walk or a plain crossfade; the walkthrough must move like
  a human walking the house in order.
- AI generation (Higgsfield etc.) is permitted only for content that does
  not depict the property itself, and only within budgets Naomi sets.
- Before concluding footage "doesn't exist", inventory EVERY folder of
  every Dropbox share completely. The full-house footage existed all along
  in "25.09.10 Walkthroughs".

## Working notes

- Deploys: push to `main` → Vercel auto-deploy (~2 min). Claude sessions
  cannot push; Naomi runs the push.
- Scroll walkthrough: `src/components/ScrollWalk.astro`; frame sets live in
  Supabase `media/scrollwalk/<slug>-vN/` (versioned folders — files are
  cached immutable, so every new cut needs a new folder + page reference).
- The public QASR cut is deliberately curated — mud room, sauna, guest
  suites, powder, dining, cellar etc. are held back pre-sale. Do not add
  rooms without Naomi's sign-off. The full private tour lives on Naomi's
  Desktop and in the private `private-media` Supabase bucket.
