# Phase 4 — Booking engine: holds, inventory, real-time, checkout (no payment yet)

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-4/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_4_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 3 passed.

## Goal
Seats can be held, released and expire correctly under concurrency, the 3D view shows live state, and checkout reaches the "pay" step.

## Tasks
1. `POST /bookings/hold`, `release`, `extend` (once), `GET /bookings/{id}`: PostgreSQL transactions with `SELECT ... FOR UPDATE`, idempotency keys, max seats per booking, per-user and per-IP rate limits. States: AVAILABLE, HELD, PAYMENT_PENDING, BOOKED. Hold duration from config (default 5 minutes).
2. Background sweeper that releases expired holds safely; an expired hold can never become a booking.
3. WebSocket `/ws/showtimes/{id}` broadcasting seat state diffs through Redis; client reconciles through REST after reconnect. Remove the Phase 2 mock status; the 3D view now uses real inventory.
4. Pricing engine: category and format and time rules, convenience fee, configurable GST, coupon validation (min amount, per-user limit, expiry), F&B add-ons.
5. Frontend: **standard 2D seat map as the default step** built from the real layout (`SeatMap2D`, per `DESIGN_SPEC.md` §4.3) with live WebSocket state, Best available, sticky summary, trailer mini-player and the **"Explore in 3D" button** that opens the Phase 2 theatre with shared selection, holds and countdown in both directions; ticket-count step, add-ons step, checkout page with summary, coupon, contact details and a visible hold countdown, expiry handling, and a payment step that is clearly a stub until Phase 5.

## Tests and evidence
- Concurrency: 50 parallel clients hold the same seat, exactly one wins.
- Expiry: hold expires, seat becomes available, late confirmation is refused.
- Idempotent repeat of a hold request creates no duplicate.
- Two browsers: a hold in browser A turns the seat amber in browser B within a second or two.
- Price and tax math tests with fixed fixtures.
- Playwright: select seats in the 2D map, open 3D and see the same seats selected, change the selection in 3D and see it in 2D, checkout, wait for expiry, verify release, keyboard-only run of the 2D map, 3D button hidden when WebGL is off.

## Security gate (see `SECURITY_SPEC.md`)
Seat-hoarding bot test, per-user/IP hold limits and cooldowns, idempotency keys, server-computed prices, coupon race tests, WebSocket auth/origin/rate/size limits, IDOR tests on bookings.
Evidence in `docs/evidence/phase-4/security.md`; unresolved findings block the exit gate.

## Exit gate
No double booking is possible in any test, live updates work, stub payment step labelled.
