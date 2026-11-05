# Phase 3 — Core site: discovery, movies, cinemas, showtimes

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-3/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_3_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 1 and Phase 2d passed (3D theatre fixed, light simple UI in place).

## Build-state check (read first)
Earlier build sessions did not follow this phase numbering strictly (see `docs/PROJECT_STATUS.md` and the latest audit). Before writing code, find out what already exists for this phase. If a feature exists, do NOT rebuild it: audit it against this prompt and `COMMON_RULES.md`, keep what passes, fix what fails, and list every item in the report as AUDITED-OK, FIXED or BUILT. Never mark something as built unless you ran it and have evidence.

## Goal
The browsing half of a BookMyShow-class site, all from real API data, ending at "Enter 3D theatre" for a chosen showtime.

## Tasks
1. Backend read APIs with pagination and filters: cities, movies (language, genre, format, certificate, status, sort), movie detail, cinemas, cinema detail, showtimes by movie/cinema/date/city with computed availability labels, global search (Postgres full text plus trigram).
2. Frontend: city selector modal (persisted), home (ONE hero for the movie of the day, then only Now showing, Coming soon and Offers; see Tightening), movies listing with URL-synced filters, movie detail (trailer lazy-embed, cast, ratings, showtimes by cinema for 7 dates), cinema list and detail, search with suggestions and recent searches.
3. Showtime chips lead to the **standard seat selection page** (built in Phase 4; until then a labelled placeholder). The 3D theatre is reached from that page's "Explore in 3D" button and from cinema pages. Build the reusable **`TrailerPlayer`** and **`MiniPlayerDock`** per `DESIGN_SPEC.md` §6 (HLS with quality and captions, PiP/mini player, resume, Save-Data aware, keyboard accessible, single active media element) plus the media pipeline (upload, scan, transcode to HLS, poster, hover preview, captions, signed URLs). Seed at least two licensed or self-made sample trailer videos so playback is testable without external services.
4. Skeletons, empty and error states, responsive layouts, SEO basics (SSR/ISR, metadata, OpenGraph, JSON-LD for Movie), accessibility basics.

## Tightening (added after review; these override the task list above where they conflict)
1. **Simple home page:** ONE hero for the movie of the day (two buttons: Book tickets, Watch trailer), then only three rows: Now showing, Coming soon, Offers. No carousel, trending row, top-cinemas row or 3D showcase (the "For you" row arrives in Phase 13). Header: Movies, Cinemas, My Tickets, city, search, Sign in only.
2. **Showtime chips use server data:** each chip shows the start time, format and the lowest price for that showtime as returned by the server (never computed in the browser), plus an availability label whose thresholds are defined once on the server (for example more than 60 percent free = Available, 20 to 60 = Fast filling, under 20 = Almost full, 0 = Sold out) and shown with text as well as colour.
3. **Per-movie trailers:** each movie has its own trailer media record; the movie page plays that movie's trailer and never another movie's; if none exists show the poster and "Trailer not available". Seed at least three different movies with different licensed or open-licence trailers (record the licence and attribution).
4. **City scoping and persistence:** everything is city-scoped; remember the last city; one-tap change.
5. **Click and speed budgets:** home to the showtime list in 3 clicks or fewer; non-3D pages LCP under 2.5 s on a mid-range phone (Lighthouse mobile); no layout shift on images (reserve poster space).
6. **Seed data realism:** at least 12 movies, 8 cinemas across the seeded cities, 7 days of showtimes with varied formats and languages, and realistic occupancy (booked 20 to 35 percent of seats on most shows, a few nearly full, one sold out) so availability labels can be tested.
7. **Light theme and type rules** from `DESIGN_SPEC.md`: 18 px body, nothing under 14 px, 48 px targets; run the automated font-size and axe scans on every page you build.
8. **Search:** typo-tolerant (full text plus trigram), suggestions and recent searches, keyboard accessible, empty state with helpful tips, rate-limited.
Add these tests: chip price equals the server value; availability label boundaries; trailer-to-movie mapping for three movies; click-count script; font-size scan; city persistence.

## Tests and evidence
API tests for filters and pagination, Playwright journey: city, movie, date, showtime, trailer plays in the modal, captions and quality switch work, mini-player persists across navigation, only one video plays at a time. Lighthouse run on home and a movie page, saved. Screenshots on desktop and mobile.

## Security gate (see `SECURITY_SPEC.md`)
Trailer media pipeline and `TrailerPlayer` (signed expiring URLs, hotlink protection, sandboxed fallback embed), sanitised rich text and reviews, search injection probes, rate limits on search, SEO pages must not leak private data, headers and CSP verified in the browser.
Evidence in `docs/evidence/phase-3/security.md`; unresolved findings block the exit gate.

## Exit gate
Complete browse journey works on real data, no dead buttons, Lighthouse numbers recorded honestly.
