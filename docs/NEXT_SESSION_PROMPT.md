# CineVerse — Remediation & Next Phase Prompt

> **Audited State Summary (2026-11-03):**  
> An independent audit completed on 2026-11-03 confirmed that Phases 1, 4, 6, 7, 8, 9, and 12 are largely functional with verified concurrency, 3D seat mapping, and turnstile scanning. However, the audit flagged **1 Critical** and **1 High** issue that must be fixed before proceeding to Phase 10 or 11:
> - **CRITICAL (FIX-01)**: `frontend/app/checkout/page.tsx` contains hardcoded Phase 4 payment gateway stubs and transmits a bypass token (`test_signature_valid`), which the backend accepts via a test backdoor in `backend/app/services/payment_service.py:24`.
> - **HIGH (FIX-02)**: Test database state pollution (`Showtime 1` moved to +2 days in `backend/tests/test_phase12_operations.py` and rate-limit exhaustion) breaks `test_showtimes_and_seats_inventory`, `test_seat_hold_concurrency_race_condition`, `test_full_booking_payment_and_qr_ticket_lifecycle`, and Playwright `phase3_browse_journey.spec.ts`.
> - **MEDIUM (FIX-03)**: 2 TypeScript errors in `frontend/e2e/phase4_booking_engine.spec.ts:210,212` prevent `npx tsc --noEmit` from completing cleanly.

---

## Instructions for this session

### Step 1: Fix Blockers First (Priority Order)

1. **Resolve FIX-02 (Test Isolation & DB Pollution)**:
   - In `backend/tests/test_phase12_operations.py`, ensure any test creating bookings or shifting showtimes uses an isolated test showtime rather than modifying `Showtime 1` in place.
   - In `backend/tests/test_phase12_operations.py::test_ticket_transfer_flow_and_security_limits`, clean up existing `ticket_transfer_logs` for user 3 at the start of the test so the 5 transfers/month rate limit is not exceeded during repeated test runs.
   - Verify that all 46 backend tests pass cleanly:
     ```powershell
     $env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m pytest backend/tests/ -v
     ```

2. **Resolve FIX-03 (TypeScript Errors)**:
   - In `frontend/e2e/phase4_booking_engine.spec.ts` lines 207-215, typecast the canvas prototype mock to `any` so that `npx tsc --noEmit` passes with 0 errors:
     ```powershell
     cd frontend; npx tsc --noEmit
     ```

3. **Resolve FIX-01 (Phase 5 Real Checkout Integration)**:
   - In `frontend/app/checkout/page.tsx`, mount the real Razorpay checkout SDK script (`https://checkout.razorpay.com/v1/checkout.js`).
   - Wire up the client Razorpay handler with `order.key_id`, `order.order_id`, and callback to `/api/v1/payments/verify`.
   - Remove the `[Phase 4 Stub]` text and the backend signature bypass in `backend/app/services/payment_service.py:24` (or restrict it strictly to explicit CI mock flags).

4. **Verify Playwright Suites**:
   - In `frontend/e2e/auditorium.spec.ts`, adjust the console error filter to ignore `net::ERR_FAILED`.
   - In `frontend/e2e/website_full_flow.spec.ts`, preset `localStorage.setItem('cineverse_city', 'bengaluru')` so the city modal does not intercept clicks.
   - Re-run all Playwright tests:
     ```powershell
     cd frontend; npx playwright test
     ```

---

### Step 2: Next Phase Execution (Phase 10 — Group Booking)

Once all fixes in Step 1 pass and all earlier test suites are green:
- Begin **Phase 10 — Group booking**: shared seat picking, split payment, and invite links.
- Prompt reference: `phases/phase-10.md` (or Phase 10 specification in `CINEVERSE_WEBSITE_PROMPT.md`).
- Implement group booking sessions, invite token generation/verification, live WebSocket group participant synchronization, and split payments.
- Add backend Pytest suite in `backend/tests/test_phase10_group_booking.py`.
- Add Playwright E2E test in `frontend/e2e/phase10_group_booking.spec.ts`.
- Save evidence under `docs/evidence/phase-10/`.
- Update `docs/PROJECT_STATUS.md` and write `docs/PHASE_10_REPORT.md`.

---

> **Rule:** Stop at the exit gate of Phase 10, write `docs/PHASE_10_REPORT.md`, and wait for review. Do NOT begin Phase 11.

