# Phase 12 — Venue operations and scale: layout onboarding tool, entry scanning, at-seat orders, membership, ticket transfer

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md`, `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence under `docs/evidence/phase-12/`. Diagnose and fix failures; do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_12_REPORT.md` (PASS / FAIL / NOT DONE table), then STOP for review.

**Entry gate:** Phases 1 to 7 passed; Phase 5 payments stable.

## Goal
Onboard new cinemas without developers, run the entrance and concessions, and add loyalty features.

## Tasks
1. **Auditorium onboarding tool (admin):** upload a GLB, then a backend validation and extraction service that turns the manual scripts (`tools/generate_seat_layout.py`, `tools/generate_walk_nav.py`) into a reusable pipeline: detect seat nodes by a configurable name pattern, derive bounds and eye positions, screen and tier geometry, walkable surfaces and colliders; detect the coordinate convention from node matrices (do not assume Y-up) and report it; flag problems (missing screen, duplicate IDs, unreachable areas, triangle budget exceeded, missing aisle stairs); let the admin edit row labels, categories, aisles, accessible seats, and seat numbering direction; preview in the 3D viewer and the 2D map before publishing; versioned `theatre_assets` with rollback.
2. **Optimised asset generation:** run the web optimisation (mesh simplification for repeated seat geometry, compression) as a background job, store the result and the metrics, and let the admin compare before and after.
3. **Entry scanning PWA for staff:** camera QR scan with the Phase 5 single-use validation, offline-tolerant queue with conflict handling, gate/door assignment, manual lookup, accessible UI, role and device registration, rate limits, audit trail.
4. **At-seat food and drink pre-order:** order with a booking, choose pickup at counter or delivery to seat (row and seat shown to staff in a kitchen display view with status: preparing, ready, delivered), payment through the existing flow, cut-off times, refunds when cancelled.
5. **Membership and loyalty:** points ledger with earn/redeem rules, tiers, optional monthly pass (server-enforced entitlements, clear terms, cancel anytime, no dark patterns), referral rewards with fraud limits.
6. **Ticket transfer (limited):** transfer an unused ticket to another registered account up to a cutoff before showtime, original QR invalidated and a new one issued, transfer limits per ticket and per user, no public resale marketplace, full audit log. Check local rules before enabling; keep behind a feature flag.
7. **Notifications:** web push and email reminders (showtime soon, gate info, parking), preferences and quiet hours, consent aware.
8. **Multi-venue scaling checks:** several auditoriums with different layouts in seed data (include one 2D-only screen and one generated from a second test GLB), per-cinema configuration, caching, indexes verified with query plans.

## Tests and evidence
Onboarding tests with the supplied GLB (must reproduce `seat_layout_v2.json` and `walk_nav_v2.json` within tolerance), broken GLB cases, a second synthetic GLB with a different convention, scanning tests (valid, used, forged, expired, offline replay), kitchen display state tests, transfer race and abuse tests, entitlement tests for passes, Playwright flows for admin onboarding and staff scanning on a phone viewport.

## Security gate (see `SECURITY_SPEC.md`)
Staff devices and roles, scanner token scopes, transfer abuse limits, pass entitlement integrity, upload sandboxing for GLBs, no PII in kitchen display beyond what staff need.

## Exit gate
A new auditorium is added through the UI from a GLB alone, scheduled, booked, scanned at the gate and ordered for at the seat, all in test mode, with the original auditorium unchanged.
