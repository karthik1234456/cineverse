# Phase 3 — Core site: discovery, movies, cinemas, showtimes

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-3/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_3_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 2 passed.

## Goal
The browsing half of a BookMyShow-class site, all from real API data, ending at "Enter 3D theatre" for a chosen showtime.

## Tasks
1. Backend read APIs with pagination and filters: cities, movies (language, genre, format, certificate, status, sort), movie detail, cinemas, cinema detail, showtimes by movie/cinema/date/city with computed availability labels, global search (Postgres full text plus trigram).
2. Frontend: city selector modal (persisted), home (hero carousel, now showing, coming soon, trending, top cinemas, offers, 3D showcase), movies listing with URL-synced filters, movie detail (trailer lazy-embed, cast, ratings, showtimes by cinema for 7 dates), cinema list and detail, search with suggestions and recent searches.
3. Showtime chips lead to the **standard seat selection page** (built in Phase 4; until then a labelled placeholder). The 3D theatre is reached from that page's "Explore in 3D" button and from cinema pages. Build the reusable **`TrailerPlayer`** and **`MiniPlayerDock`** per `DESIGN_SPEC.md` §6 (HLS with quality and captions, PiP/mini player, resume, Save-Data aware, keyboard accessible, single active media element) plus the media pipeline (upload, scan, transcode to HLS, poster, hover preview, captions, signed URLs). Seed at least two licensed or self-made sample trailer videos so playback is testable without external services.
4. Skeletons, empty and error states, responsive layouts, SEO basics (SSR/ISR, metadata, OpenGraph, JSON-LD for Movie), accessibility basics.

## Tests and evidence
API tests for filters and pagination, Playwright journey: city, movie, date, showtime, trailer plays in the modal, captions and quality switch work, mini-player persists across navigation, only one video plays at a time. Lighthouse run on home and a movie page, saved. Screenshots on desktop and mobile.

## Security gate (see `SECURITY_SPEC.md`)
Trailer media pipeline and `TrailerPlayer` (signed expiring URLs, hotlink protection, sandboxed fallback embed), sanitised rich text and reviews, search injection probes, rate limits on search, SEO pages must not leak private data, headers and CSP verified in the browser.
Evidence in `docs/evidence/phase-3/security.md`; unresolved findings block the exit gate.

## Exit gate
Complete browse journey works on real data, no dead buttons, Lighthouse numbers recorded honestly.
