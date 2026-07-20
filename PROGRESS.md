# Go-Live Refine — Progress Log

## Phase 0 — Setup & safety (2026-07-20)
- **Repo:** working in `/Users/naomidurcau/Desktop/New sabdia website`, a clone of the official
  `github.com/naomisabdia-hub/sabdia-website`. Old folders `~/sabdia-website` and `~/Website`
  (NaomiSab1 remotes, outdated static site) identified and left untouched.
- **Local state:** `main` was 8 commits **ahead** of `origin/main` (unpushed work from a previous
  session: client-side routing, budget gating, ink-and-gold styling, reveal failsafes — local tags
  v3.6-client-routing, v3.7-ink-and-gold, v3.8-reveal-failsafe). Remote only has up to
  v3.5-listing-components. Remote is a strict ancestor — pushing would be a safe fast-forward.
  **Decision pending at Checkpoint 1.**
- **Env:** `.env` already present (today) — Supabase (all keys) + Clerk configured. Resend not set
  (enquiry email copies dormant; Supabase still stores leads).
- **Dev server:** runs clean on :4321 (Astro 5.18.2), no console errors on homepage.
- **Key finding:** 7 of 15 homepage images now FAIL to load — all `static.wixstatic.com` URLs.
  The Wix dependency is actively broken, not just a risk. 13 files reference wixstatic.
- **Admin:** Clerk-gated sign-in (development mode), on-brand. Needs Naomi's login for admin testing.
- **Safety:** baseline tag `v3.9-baseline` on HEAD (98413d2); working branch `refine/go-live` created.
  (Prompt's suggested v3.6–v3.8 tag names were already taken by the local work, so the scheme
  continues from v3.9.)
- Baseline screenshots taken: homepage, Caspian property page, contact, /admin — desktop + mobile.

## Phase 1 — Deep audit (2026-07-20)
- Pushed main (3f81a34→98413d2) + tags v3.6–v3.9 to origin per Naomi's go.
- Full audit written to AUDIT.md: 3× 🔴 (Wix images actively failing; no favicon; OG missing
  on 8 pages), 9× 🟡, 3× 🟢. All 16 Wix source images still downloadable — recovery window open.
- Confirmed production content flows from Supabase (properties + site_content), so the image
  migration must update DB rows too — flagged for approval at Checkpoint 2.
