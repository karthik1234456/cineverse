# Phase 4 — Booking engine: holds, inventory, real-time, checkout (no payment yet)

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-4/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_4_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 3 passed.

## Build-state check (read first)
Earlier build sessions did not follow this phase numbering strictly (see `docs/PROJECT_STATUS.md` and the latest audit). Before writing code, find out what already exists for this phase. If a feature exists, do NOT rebuild it: audit it against this prompt and `COMMON_RULES.md`, keep what passes, fix what fails, and list every item in the report as AUDITED-OK, FIXED or BUILT. Never mark something as built unless you ran it and have evidence.

## Goal
Seats can be held, released and expire correctly under concurrency, the 3D view shows live state, and checkout reaches the "pay" step.

## Tasks
1. `POST /bookings/hold`, `release`, `extend` (once), `GET /bookings/{id}`: PostgreSQL transactions with `SELECT ... FOR UPDATE`, idempotency keys, max seats per booking, per-user and per-IP rate limits. States: AVAILABLE, HELD, PAYMENT_PENDING, BOOKED. Hold duration from config (default 5 minutes).
2. Background sweeper that releases expired holds safely; an expired hold can never become a booking.
3. WebSocket `/ws/showtimes/{id}` broadcasting seat state diffs through Redis; client reconciles through REST after reconnect. Remove the Phase 2 mock status; the 3D view now uses real inventory.
4. Pricing engine: category and format and time rules, convenience fee, configurable GST, coupon validation (min amount, per-user limit, expiry), F&B add-ons.
5. Frontend: **standard 2D seat map as the default step** built from the real layout (`SeatMap2D`, per `DESIGN_SPEC.md` §4.3) with live WebSocket state, Best available, sticky summary, trailer mini-player and the **"Explore in 3D" button** that opens the Phase 2 theatre with shared selection, holds and countdown in both directions; ticket-count step, add-ons step, checkout page with summary, coupon, contact details and a visible hold countdown, expiry handling, and a payment step that is clearly a stub until Phase 5.

- **Build `SeatMap2D` on `frontend/lib/seatMapLayout.ts`** (tested); do not re-derive row/column/aisle layout in the component.

## Tightening (added after review; these override the task list above where they conflict)
1. **Server price quote, locked at hold time.** `GET /showtimes/{id}/seats` returns for every seat its status, category and price (the same data the 2D map, 3D tooltip, seat card, legend, bottom bar, checkout, ticket and email use). When seats are held the server stores a **price quote** with the hold (per-seat price, fee, GST, discount, total, rules version); checkout shows exactly that total and the page says "The price shown at checkout is final." If pricing rules change during a hold, the held quote stands until the hold expires. Test it.
2. **Categories and bands come from data** (database), never from row-letter rules in the client; the legend is generated from the same data. Include accessible and companion seat attributes and the cinema's booking rules for them.
3. **Hold ownership and recovery:** distinguish "held by me" from "held by someone else"; one active hold per user per showtime; reloading the page or opening a second tab restores my hold and countdown; leaving the page releases the hold promptly (best-effort) or lets it expire; hold timer shown calmly with a single warning near the end and one allowed extension.
4. **Deadlock-safe multi-seat holds:** lock seat rows in a consistent order (for example sorted by seat id) inside one transaction; test two clients holding overlapping seat sets in opposite order; use database time, not application clocks, for expiry; the sweeper is idempotent and runs in a worker, tested with a controllable clock.
5. **Real-time protocol:** each showtime has a monotonically increasing sequence number on seat-state messages so clients ignore stale or out-of-order updates and resync through REST after a gap or reconnect (exponential back-off); messages contain only seat id, state and sequence (no personal data); authenticated connections, origin check, rate and size limits.
6. **Edge-case behaviour with plain-language copy** (write `docs/design/states-and-a11y.md` if missing): seat just taken (offer the nearest alternatives), hold expired, show sold out, no seats together for N people, network lost during hold, reconnect, show already started or cancelled.
7. **Simple steps and defaults:** ticket count defaults to 2 (maximum 8); a basic "Best seats for me" that picks adjacent seats in the middle rows within one block (Phase 11 improves it); the three steps Show, Seats, Pay with one primary button per screen; snacks and coupon collapsed; the "See it in 3D" button secondary; keyboard-only operation of the 2D map with accessible names such as "Row E, seat 6, Prime, 250 rupees, available".
8. **Pricing engine details:** integer paise everywhere, configuration for fee and GST read from the database, documented rounding, atomic coupon redemption with per-user and global limits, add-on prices from the server.
9. **Realistic demo inventory** (booked 20 to 35 percent, a few held), never hard-coded in the frontend.
Add these tests (on PostgreSQL via docker compose): price quote lock, price agreement across API and every UI component for all 100 seats and two showtimes, multi-seat deadlock test, hold restore after reload, sequence-number ordering, sweeper with a fake clock, a rule that a held-by-me seat can be released but a held-by-other seat cannot.

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
