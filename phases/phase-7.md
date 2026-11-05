# Phase 7 — Admin and cinema-partner portals, analytics

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-7/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_7_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 6 passed.

## Build-state check (read first)
Earlier build sessions did not follow this phase numbering strictly (see `docs/PROJECT_STATUS.md` and the latest audit). Before writing code, find out what already exists for this phase. If a feature exists, do NOT rebuild it: audit it against this prompt and `COMMON_RULES.md`, keep what passes, fix what fails, and list every item in the report as AUDITED-OK, FIXED or BUILT. Never mark something as built unless you ran it and have evidence.

## Goal
Operators can run the platform without touching the database.

## Tasks
1. Role-protected admin area separated from customer routes: movies, cinemas, auditoriums, **seat layout and GLB upload** (validate file type and size, node names, triangle budget; map nodes to seats; preview in the 3D viewer before publishing; versioned `theatre_assets`), showtimes (bulk scheduling and screen conflict detection), pricing rules, coupons, F&B menu, users, reviews moderation, CMS.
1b. Trailer and poster management: upload, transcoding status, captions, rights-holder/licence confirmation, preview, publish/unpublish, replace.
2. Bookings management: search, refund, cancel, resend ticket.
3. Cinema-manager role limited to their own cinemas (enforced server-side).
4. Analytics: revenue, occupancy, top movies and cinemas, funnel (view, hold, pay), payment failure reasons; CSV export.
5. Audit log for every admin action.

## Tightening (added after review; these override the task list above where they conflict)
1. **Scope boundary with Phase 12:** this phase delivers upload, validation, preview and manual seat mapping of a GLB. The fully automatic extraction of seats, screen, tiers and walk data (the onboarding tool) is Phase 12.
2. **Pricing rules are safe by design:** category bands and prices per format, weekday and time of day, with a floor and ceiling, a preview that shows the exact seat price map customers will see, versioning, an audit trail, and a second-person approval for large changes. Changes never alter active holds or already issued quotes. No per-person pricing.
3. **Cancel a show:** a guarded action that previews every affected booking and refund amount (dry run), then refunds and notifies idempotently in batches with progress and failures recorded; requires MFA step-up; written to the audit log; tested with a few hundred bookings.
4. **Showtime scheduling:** bulk creation with conflict detection per screen, cleaning buffers between shows, India Standard Time handling, and a clear calendar view.
5. **Operations views:** search bookings, refund, cancel, resend ticket, release stuck seats; exports are CSV with spreadsheet-formula injection protection and minimal personal data.
6. **Analytics are defined, not guessed:** write a short definition for each metric (revenue net of refunds, occupancy, conversion funnel from view to hold to paid, payment failure reasons) and test the numbers against known seed data.
7. **Audit log is append-only** (database protections or a hash chain), has a viewer with filters, and records who, what, before and after, and when for every admin action.
8. **Roles in practice:** admin, cinema manager (own cinemas only, enforced in every query), support (read bookings, request refunds, no pricing or user management). Shorter admin sessions, MFA required, admin never reachable from the customer app navigation.
9. **Admin UI is plain too:** same type sizes and contrast, clear forms with validation messages, confirmation dialogs for destructive actions, accessible tables.
Add these tests: manager scope on every list and detail endpoint, support role limits, pricing floor and ceiling and approval, show cancellation dry run versus real run, GLB validation with malformed files (wrong node names, external URIs, oversized, too many triangles), CSV injection, audit log immutability, analytics numbers versus seed data.

## Tests and evidence
Permission tests (manager cannot see another cinema, customer cannot reach admin), GLB validation tests with a broken file, showtime conflict tests, analytics numbers checked against known seed data, Playwright admin flows with screenshots.

## Security gate (see `SECURITY_SPEC.md`)
Validated GLB upload in a sandboxed worker, image re-encoding, video upload via signed URL with ClamAV hook, isolated ffmpeg worker with resource limits, rights-holder confirmation before publish, MFA step-up for refunds, append-only audit log, manager-scope tests.
Evidence in `docs/evidence/phase-7/security.md`; unresolved findings block the exit gate.

## Exit gate
Create a new auditorium with an uploaded model, schedule a show, and book a seat in it as a customer, all through the UI.
