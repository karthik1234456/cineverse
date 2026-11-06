# Checkout Server Quote Hardening & Clean URL Verification Report

**Date:** 2026-11-06  
**Auditor:** Antigravity Agent  
**Environment:** Next.js 14.2.23 (Production Build, port 3001) + FastAPI (Uvicorn, port 8000) + SQLite/PostgreSQL  
**Evidence Directory:** `docs/evidence/checkout-server-quote/`

---

## 1. Executive Summary

This hardening initiative resolves all vulnerabilities associated with client-controlled query parameters and client-controlled pricing in the CineVerse checkout flow:
1. **Clean URL Structure**: Completely eliminated `total`, `seats`, and `addons` from checkout URLs across 2D SeatMap, 3D Auditorium HUD, Mobile Controls, and Fallback seat lists. The URL now strictly carries an opaque, unguessable hold token: `/checkout?hold_id=hold_[a-zA-Z0-9]+`.
2. **Server-Locked Authoritative Quote**: The checkout page loads pricing, taxes, convenience fees, attached add-ons, and coupon discounts exclusively via authenticated server endpoint `GET /api/v1/bookings/hold/{hold_id}`.
3. **IDOR & Security Protections**: A user attempting to access another user's hold receives `403 Forbidden` ("Access Restricted"). Unauthenticated users are gated with a clear "Sign In Required" modal state. Expired or non-existent holds return `404 Not Found` ("Reservation Not Available"). Replay of converted holds is rejected with `400 Bad Request`.
4. **Tamper-Proof Order & Booking Creation**: Tampering with the URL (e.g. `?hold_id=...&total=1&seats=A01`) or modifying client request bodies is completely ignored—payment orders and bookings derive showtimes, seats, addons, and final payable amounts solely from the server's locked hold in memory/Redis/database.
5. **App-Wide Currency Standardization**: Display amounts are formatted strictly as integer rupees (`₹760`, zero decimals, never `₹760.0` or `.toFixed(2)`).
6. **Price Guarantee**: Displayed the prominent guarantee banner: `"The price shown at checkout is final"`.

---

## 2. Requirement Verification & Test Results

| # | Requirement | Implementation / Fix | Status | Evidence / Test |
|---|-------------|----------------------|:------:|-----------------|
| **1** | Remove total, seats, and add-ons from URL. Keep at most opaque, unguessable hold ID. | Updated `SeatMap2D`, `SelectedSeatsBar`, `MobileControls`, and `FallbackSeatList` to navigate to `/checkout?hold_id=${holdId}`. Regex validation in Playwright ensures zero price/seat params exist. | **PASS** | `01_clean_checkout_url_1280.png`, `02_clean_checkout_url_390.png`, `03_clean_checkout_url_768.png`, `phase_checkout_hardening.spec.ts` (Test 01, 02) |
| **2** | Checkout page fetches hold from server; login required; hold must belong to user (403/404); locked quote truth. | `GET /api/v1/bookings/hold/{hold_id}` with `require_user` dependency. Verifies `held_by_user_id == current_user.id`. `page.tsx` renders server line items and prices. | **PASS** | `05_unauthenticated_login_required.png`, `06_idor_403_rejected.png`, `07_expired_hold_404.png`, `test_checkout_server_quote.py` |
| **3** | Payment order creation uses only server quote. Probes: URL edit, body edit, replay old hold, another user hold, expired hold. | `create_booking` and `create_order` calculate totals strictly from server hold metadata. Client payload ignores amounts. IDOR returns 403, expired returns 400/404, replay returns 400. | **PASS** | `04_tamper_attempt_ignored.png`, `08_order_creation_server_quote.png`, 8/8 tests in `test_checkout_server_quote.py` |
| **4** | App-wide search for prices/seat lists in URLs, localStorage, or hidden form fields and removal. | Recursive codebase audit confirmed zero URL parameters or client state passing totals or seat lists to checkout. Removed legacy decimal `.toFixed(2)` price formats in 6 components. | **PASS** | Codebase audit, Vitest parity tests (49/49 passed), zero grep hits for `total=` or `seats=` in checkout links |
| **5** | Display guarantee banner: "The price shown at checkout is final" and format amounts as integer rupees without decimals. | Added emerald guarantee badge on `/checkout` and formatted all prices with `Math.round()` / integer rupee strings. | **PASS** | `03_clean_checkout_url_768.png`, `phase_checkout_hardening.spec.ts` (Test 03) |

---

## 3. Test Suite Executions

- **Backend Pytest Suite (`backend/tests/test_checkout_server_quote.py`)**:
  - `test_server_quote_locked_calculation_and_guarantee` -> **PASSED**
  - `test_idor_protection_another_user_hold_refused` -> **PASSED** (403 Forbidden verified)
  - `test_unauthenticated_hold_quote_requires_login` -> **PASSED** (401 Unauthorized verified)
  - `test_expired_hold_refused_with_friendly_message` -> **PASSED** (404/400 verified)
  - `test_replay_old_hold_id_refused` -> **PASSED** (400 Bad Request verified)
  - `test_request_body_tampering_seat_and_showtime_mismatch_refused` -> **PASSED**
  - `test_addons_and_coupon_attached_to_server_quote` -> **PASSED**
  - `test_payment_order_creation_uses_only_server_quote` -> **PASSED**
  - **Overall Backend**: **85/85 passed** in 41.44s.

- **Frontend Vitest Suite**:
  - **8 test files, 49/49 tests passed** (100% green).

- **TypeScript Typecheck (`tsc --noEmit`)**:
  - **0 errors** (exit code 0).

- **Playwright End-to-End Test Suite (`e2e/phase_checkout_hardening.spec.ts`)**:
  - 01. Clean URL: URL contains only opaque hold_id -> **PASSED** (4.5s)
  - 02. Responsive clean checkout layout: 390px & 768px -> **PASSED** (2.6s)
  - 03. Server quote guarantee & integer currency formatting -> **PASSED** (1.9s)
  - 04. Client-side URL tampering probe: injecting total=1&seats=A01 ignored -> **PASSED** (3.3s)
  - 05. Unauthenticated user accessing /checkout?hold_id=... prompted to sign in -> **PASSED** (6.4s)
  - 06. IDOR Security Probe: User B cannot access User A hold (403 Forbidden) -> **PASSED** (2.6s)
  - 07. Expired or non-existent hold renders 404 Reservation Not Available -> **PASSED** (1.3s)
  - 08. Order creation and payment confirmation uses exclusively server locked quote -> **PASSED** (3.1s)
  - **Overall E2E**: **8/8 passed** in 30.0s.

- **Playwright Regression Suite (`e2e/phase5_payments.spec.ts`)**:
  - **8/8 passed** in 26.9s.

---

## 4. Evidence Files Captured (`docs/evidence/checkout-server-quote/`)

1. [01_clean_checkout_url_1280.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/01_clean_checkout_url_1280.png) — Desktop 1280px clean checkout showing opaque `hold_id`, guarantee banner, and integer currency.
2. [02_clean_checkout_url_390.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/02_clean_checkout_url_390.png) — Mobile 390px clean checkout layout.
3. [03_clean_checkout_url_768.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/03_clean_checkout_url_768.png) — Tablet 768px clean checkout layout.
4. [04_tamper_attempt_ignored.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/04_tamper_attempt_ignored.png) — Proof that URL tampering (`total=1&seats=A99&discount=999`) has zero effect on the rendered server quote.
5. [05_unauthenticated_login_required.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/05_unauthenticated_login_required.png) — Gated access for anonymous visitors with "Sign In Required" prompt.
6. [06_idor_403_rejected.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/06_idor_403_rejected.png) — IDOR probe proof: User B navigating to User A's hold receives 403 "Access Restricted".
7. [07_expired_hold_404.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/07_expired_hold_404.png) — Expired or invalid hold renders 404 "Reservation Not Available".
8. [08_order_creation_server_quote.png](file:///d:/projects/CineVerse/docs/evidence/checkout-server-quote/08_order_creation_server_quote.png) — Successful booking confirmation using exclusively server-locked pricing.

---

## 5. Git Commit Log

- `f3ce046` — `feat(checkout): Part 1 - server-side locked quote, authenticated hold lookup, and tamper-proof booking creation`
- `da5dcd1` — `feat(checkout): Part 2 - opaque hold_id URL, client total removal, and server-driven checkout UI`
- `7e4e755` — `refactor(pricing): Part 3 - remove decimal price formatting and eliminate client-side totals app-wide`
- `3cd8c23` — `test(checkout): Part 4 - end-to-end verification, security test proofs, and production evidence`

