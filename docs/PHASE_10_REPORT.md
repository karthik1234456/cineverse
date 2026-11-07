# Phase 10: Group Booking, Real-Time Shared Selection & Split Payment

**Date:** 2026-11-07  
**Branch:** `phase-10-group-booking`  
**Status:** **PASSED (Verified)**  
**Specification:** `phases/phase-10.md`, `docs/group-payment.md`, `DESIGN_SPEC.md`, `SECURITY_SPEC.md`  

---

## 1. Executive Summary

Phase 10 delivers collaborative group cinema booking with zero seat or financial loss. Friends can assemble a group via an expiring, revocable invite link or QR code, pick seats collaboratively in real time across both the 2D seat map and 3D auditorium, lock the selection into a unified group hold, and pay their individual shares via separate Razorpay orders.

Money and seat safety are guaranteed by a formal pure state machine reducer (`reduce(state, event) -> (state, effects)`) paired with runtime invariant assertions in both Python (`backend/app/services/group_payment_sm.py`) and TypeScript (`frontend/lib/groupPayment.ts`).

---

## 2. Core Architectural Components

### 2.1 Formal State Machine & Invariant Engine
The state machine governs the entire group payment lifecycle across phases:
`FORMATION` $\rightarrow$ `HELD` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `CONFIRMED` (or `EXPIRED` / `CANCELLED`).

Six mathematical invariants are asserted after every event transition:
1. **Confirmation Integrity:** `CONFIRMED` occurs if and only if `capturedTotal == total` and exactly once (`confirmEmitted == 1`).
2. **Money Conservation:** $\text{capturedTotal} = \text{keptForBooking} + \text{refundRequested}$. Zero paise are unaccounted for.
3. **Clean Terminal State:** When `EXPIRED` or `CANCELLED`, `keptForBooking == 0` and every captured payment has an associated refund effect.
4. **Seat Inventory Soundness:** Seats are held during active payment (`HELD` / `PARTIALLY_PAID`), booked only on `CONFIRMED`, and released immediately on `EXPIRED` or `CANCELLED`.
5. **Exact Share Matching:** Overpayments, underpayments, late payments, and duplicate payments are strictly rejected and immediately refunded.
6. **Host Coverage Bound:** In `host_covers` policy, the host is charged strictly the unpaid remainder ($\le \text{total}$). If this charge fails, all prior member payments are auto-refunded and seats released.

### 2.2 Backend Services & Endpoints (`/api/v1/groups`)
- `POST /api/v1/groups`: Create session with opaque token (`grp_tok_...`), invite QR, configurable max members (default 8), and timeout policy (`AUTO_REFUND` or `HOST_COVERS`).
- `GET /api/v1/groups/{group_code}`: Retrieve session metadata, members, proposed seats, and hold status.
- `POST /api/v1/groups/join`: Join session via invite token; enforces authentication, duplicate join prevention, and anti-hoarding capacity limit ($\le 8$).
- `POST /api/v1/groups/{id}/propose-seat`: Propose or retract seat selection with real-time broadcast.
- `POST /api/v1/groups/{id}/confirm`: Host locks final seat allocations and acquires group hold (default 10 minutes) with split calculation in integer paise.
- `POST /api/v1/groups/{id}/extend`: Host extends hold once by 5 minutes (`max_extensions = 1`).
- `POST /api/v1/groups/{id}/order`: Generates Razorpay order for member's exact allocated share.
- `POST /api/v1/groups/{id}/pay-share`: Captures payment, transitions state machine, and triggers confirmation effects if complete.
- `POST /api/v1/groups/{id}/timeout`: Processes hold expiry with policy enforcement (`AUTO_REFUND` releases and refunds; `HOST_COVERS` attempts remainder charge).
- `GET /api/v1/groups/{id}/tickets`: Issues Ed25519-signed QR tickets for each member's specific seats.
- `POST /api/v1/groups/{id}/revoke-invite`: Host revokes pending invite link.
- `WS /api/v1/groups/ws/{group_id}`: Real-time WebSocket connection for live cursor, seat proposals, and member presence.

### 2.3 Frontend User Experience
- **"Book with friends" Entrypoint:** Accessible directly on the 2D Seat Map.
- **Group Creation Modal (`GroupBookingModal.tsx`):** Host configures timeout policy (`Auto-Refund All` vs `Host Covers Remainder`), generates QR code and shareable URL (`/booking/group/join?token=...`), and tracks member roster.
- **Live Room Banner (`GroupRoomBanner.tsx`):** Persistent banner displaying room code, avatar pills with member initials and colors, live hold expiration countdown timer, host controls ("Lock Selection & Split Payment", "Extend Hold (+5m)"), and member payment triggers ("Pay My Share (₹XXX)").
- **2D Seat Map Presence:** Proposed and held seats display member initials badges with member-specific pastel background colors and pulse animations.
- **3D Theatre Presence (`GroupSeatMarkers.tsx`):** Renders 3D Billboard avatar pins and glowing rings above proposed seats in `CinemaWorld.tsx`.
- **Individual Tickets Modal (`GroupTicketsModal.tsx`):** Renders individual member passes with Ed25519-signed turnstile-verified QR codes.

---

## 3. Verification & Test Evidence

### 3.1 Backend Test Suite (Pytest)
```
tests/test_phase10_group_payment_sm.py::test_happy_path_exact_shares_confirmed PASSED
tests/test_phase10_group_payment_sm.py::test_partial_payment_stays_partially_paid PASSED
tests/test_phase10_group_payment_sm.py::test_refund_all_on_expiry PASSED
tests/test_phase10_group_payment_sm.py::test_host_covers_policy_workflow PASSED
tests/test_phase10_group_payment_sm.py::test_late_payments_and_wrong_amounts_refunded PASSED
tests/test_phase10_group_payment_sm.py::test_idempotent_duplicate_events PASSED
tests/test_phase10_group_payment_sm.py::test_seeded_fuzz_hostile_event_sequences PASSED
tests/test_phase10_group_payment_sm.py::test_mutation_proves_tests_can_fail PASSED
tests/test_phase10_group_api.py::test_create_and_join_group PASSED
tests/test_phase10_group_api.py::test_anti_hoarding_limit PASSED
tests/test_phase10_group_api.py::test_group_confirm_hold_and_extend PASSED
tests/test_phase10_group_api.py::test_group_payment_flow_and_tickets PASSED
tests/test_phase10_group_api.py::test_group_timeout_auto_refund PASSED
tests/test_phase10_group_api.py::test_group_timeout_host_covers PASSED

============================= 14 passed in 9.11s ==============================
```

### 3.2 Frontend Unit Test Suite (Vitest)
```
 ✓ tests/unit/legendCounts.test.ts (3 tests)
 ✓ tests/unit/seatScoring.test.ts (6 tests)
 ✓ lib/seatView.test.ts (9 tests)
 ✓ tests/unit/seatMapLayout.test.ts (5 tests)
 ✓ tests/unit/phase2d_pricing_parity.test.ts (5 tests)
 ✓ lib/walkCollision.test.ts (14 tests)
 ✓ tests/unit/proceduralAuditorium.test.ts (16 tests)
 ✓ tests/unit/seatNumberingConsistency.test.ts (6 tests)
 ✓ lib/glbIntegrity.test.ts (1 test)
 ✓ tests/unit/groupPayment.test.ts (17 tests) [Fuzzing with 4,000 hostile event sequences]

 Test Files  10 passed (10)
      Tests  82 passed (82)
   Duration  2.36s
```

### 3.3 End-to-End Test Suite (Playwright)
```
  ok 1 [chromium] › e2e\phase10_group_booking.spec.ts:22:7 › 01. Group Session Creation and Policy Selection (10.3s)
  ok 2 [chromium] › e2e\phase10_group_booking.spec.ts:86:7 › 02. Live Seat Selection, Hold Locking and Split Payment Flow (52.0s)
  ok 3 [chromium] › e2e\phase10_group_booking.spec.ts:184:7 › 03. 3D Theatre Shared Presence Verification (19.4s)

  3 passed (1.5m)
```

### 3.4 Visual Artifacts & Proof
All visual evidence captured during automated execution is saved in `docs/evidence/phase-10/`:
1. `01_group_creation_modal.png`: Modal displaying timeout policy options (`Auto-Refund All` vs `Host Covers Remainder`).
2. `02_group_invite_ready.png`: Active session showing shareable invite link, copy action, and roster.
3. `03_host_proposed_seat.png`: 2D Seat Map showing proposed seat A01 with host badge and "Lock Selection & Split Payment" CTA.
4. `04_group_held_countdown.png`: Group hold locked, live countdown timer active, and "Extend Hold (+5m)" available.
5. `05_group_confirmed.png`: All shares captured, status updated to `CONFIRMED`, and "View Member Tickets & QR" CTA displayed.
6. `06_group_tickets_qr.png`: Individual member tickets with Ed25519-signed QR codes and turnstile verification status.
7. `07_3d_theatre_view.png`: 3D auditorium view verifying shared spatial presence and seat markers.

---

## 4. Code Quality & Type Safety

- **TypeScript Type Check:** `npx tsc --noEmit` exited with code 0 (zero errors).
- **Production Build:** `npm run build` compiled 19 static/dynamic routes with code 0.
- **Design System Compliance:** Strict light theme `#FFF8F1`, crimson `#C8102E`, min 14px font, min 48px touch targets, zero console errors.
