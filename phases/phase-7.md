# Phase 7 — Admin and cinema-partner portals, analytics

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-7/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_7_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 6 passed.

## Goal
Operators can run the platform without touching the database.

## Tasks
1. Role-protected admin area separated from customer routes: movies, cinemas, auditoriums, **seat layout and GLB upload** (validate file type and size, node names, triangle budget; map nodes to seats; preview in the 3D viewer before publishing; versioned `theatre_assets`), showtimes (bulk scheduling and screen conflict detection), pricing rules, coupons, F&B menu, users, reviews moderation, CMS.
1b. Trailer and poster management: upload, transcoding status, captions, rights-holder/licence confirmation, preview, publish/unpublish, replace.
2. Bookings management: search, refund, cancel, resend ticket.
3. Cinema-manager role limited to their own cinemas (enforced server-side).
4. Analytics: revenue, occupancy, top movies and cinemas, funnel (view, hold, pay), payment failure reasons; CSV export.
5. Audit log for every admin action.

## Tests and evidence
Permission tests (manager cannot see another cinema, customer cannot reach admin), GLB validation tests with a broken file, showtime conflict tests, analytics numbers checked against known seed data, Playwright admin flows with screenshots.

## Security gate (see `SECURITY_SPEC.md`)
Validated GLB upload in a sandboxed worker, image re-encoding, video upload via signed URL with ClamAV hook, isolated ffmpeg worker with resource limits, rights-holder confirmation before publish, MFA step-up for refunds, append-only audit log, manager-scope tests.
Evidence in `docs/evidence/phase-7/security.md`; unresolved findings block the exit gate.

## Exit gate
Create a new auditorium with an uploaded model, schedule a show, and book a seat in it as a customer, all through the UI.
