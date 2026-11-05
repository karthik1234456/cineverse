# Phase 10 — Group booking: shared seat picking, split payment, invites

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md`, `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence under `docs/evidence/phase-10/`. Diagnose and fix failures; do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_10_REPORT.md` (PASS / FAIL / NOT DONE table), then STOP for review.

**Entry gate:** Phases 1 to 7 passed.

## Goal
Friends choose seats together, see each other live in the 2D map and the 3D theatre, and each pays their own share, with no seat lost to a half-finished group.

## Tasks
1. **Group sessions:** a host creates a group for a showtime and gets an invite link/QR (opaque, expiring, revocable token; max members configurable, default 8). Members join as logged-in users; guests must log in first. Roles: host, member.
2. **Shared real-time selection:** WebSocket room per group. Members see each other's presence and which seat each is looking at or has selected (colour and initials; in 3D, small floating markers above seats; in 2D, ring and avatar chip). Selection conflicts resolve server-side with the existing seat-hold rules (one seat, one holder). Members can propose seats; the host finalises.
3. **Group hold:** one shared hold with a longer, configurable window (default 10 minutes) that cannot be extended more than once.
4. **Split payment:** each member gets a payable share (equal split or host-assigned amounts) with its own server-created Razorpay order and verification. State machine: `GROUP_HELD → PARTIALLY_PAID → CONFIRMED`. If the window ends before everyone pays, the policy is chosen by the host up front: (a) host covers the remainder and is charged if possible, or (b) all payments are auto-refunded and seats released. Never confirm a booking that is not fully paid. Webhooks and refunds follow Phase 5 idempotency rules.
5. **Tickets:** each member receives their own ticket and QR for their seats; the host sees status.
6. **Notifications:** invite, join, seat proposed, payment reminders, hold running out, confirmed, refunded (in-app, email; web push if enabled).
7. **UI** per `DESIGN_SPEC.md` style: "Book with friends" entry on the seat page, group panel (members, paid/unpaid, copy link), mobile friendly, accessible announcements for join/leave and payment changes.

## Tests and evidence
Two or three browsers in Playwright (separate contexts): join by link, live seat visibility in 2D and 3D, conflicting picks, partial payment then timeout in both policies, duplicate/forged webhooks, member leaves mid-payment, host leaves, invite token expiry/revocation/reuse limits.

## Required design rules and test method (write the rules down first in `docs/group-payment.md`)
Model the group payment as an explicit state machine with a pure transition function (no I/O inside it); the server commits the new state and THEN executes returned effects (confirm booking, release seats, refund, charge host, notify). Money is always integer paise (never floats); equal splits must sum exactly to the total (remainder paise distributed deterministically). Invariants that must hold after EVERY event, enforced by an invariant-check function used in tests and as a production assertion:
1. A booking is confirmed only when the exact total has been captured, and the confirm effect is emitted exactly once.
2. Money conservation: captured = kept for the confirmed booking + refunds requested; refunds never exceed captured; in EXPIRED or CANCELLED states nothing is kept.
3. Duplicate events (same event id) and repeated payments (same payment id under a new event id) are no-ops; delivering every event twice yields the identical final state and effects.
4. Late payments (after expiry, cancellation or confirmation), wrong amounts, unknown members and double payment for one share are refunded, never silently kept or applied.
5. Seats are never released after confirmation, never booked without confirmation, and are always released in EXPIRED or CANCELLED.
6. Only the host can cancel; a member can only pay their own share.
Test method: example-based tests for every policy path AND a seeded randomised stream test (thousands of hostile event sequences: duplicates, out-of-order redelivery, wrong amounts, late events, forged members) checking all invariants after every event, plus a database-level concurrency test on PostgreSQL where two webhooks for the same payment race. Verify the tests can fail: deliberately break an invariant in a scratch copy (for example remove the refund on late payment) and show the suite catches it. Report the mutation results.

## Security gate (see `SECURITY_SPEC.md`)
Invite tokens unguessable, single-purpose, rate-limited; IDOR tests on group, shares and tickets; a member can never pay, view or change another member's share; WebSocket auth/origin/message limits; abuse test for creating many groups to hoard seats (per-user caps).

## Exit gate
A three-person group books four seats end to end in test mode with each paying their share, and every failure path leaves seats and money in a correct state.
