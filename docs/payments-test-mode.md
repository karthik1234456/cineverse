# CineVerse Payments: Razorpay Test Mode Guide

This document describes how Razorpay test mode is configured, tested, and verified in CineVerse, satisfying Phase 5 Tightening #10 and the CineVerse Security Specification (`SECURITY_SPEC.md`).

---

## 1. Environment & Secret Management

In accordance with strict security rules, **no real payment secrets or live credentials are ever committed to the repository**.

The application reads payment configuration from server environment variables:

```bash
# Backend (.env or shell environment)
RAZORPAY_KEY_ID="rzp_test_cineverse2026"
RAZORPAY_KEY_SECRET="test_secret_for_cineverse_ci_2026"
RAZORPAY_WEBHOOK_SECRET="test_webhook_secret_cineverse_2026"

# Frontend (.env.local or shell environment)
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_cineverse2026"
```

The CI pipeline runs with self-generated test keys and secrets; all signature generation during tests uses the standard HMAC-SHA256 algorithm with the configured test secret. No mock bypasses exist in production code (enforced by `backend/scripts/ci_check_no_bypasses.py`).

---

## 2. Official Razorpay Test Credentials (Sandbox)

### A. Test Cards
Use any future expiration date (e.g. `12/28`) and CVV `123`.

| Scenario | Card Number | Expected Result |
| :--- | :--- | :--- |
| **Standard Success** | `4111 1111 1111 1111` | OTP page prompt; entering any 6-digit OTP (e.g. `123456`) confirms payment. |
| **Insufficient Funds** | `4000 0000 0000 1002` | Immediate bank decline simulation. Seats remain locked for retry. |
| **3D Secure Failure** | `4000 0000 0000 1004` | 3DS authentication failure. User is returned to checkout with retry options. |
| **International Card** | `4000 0000 0000 1008` | Requires 3D Secure verification with dynamic currency check. |

### B. Test UPI Virtual Payment Addresses (VPAs)

| Scenario | Virtual Payment Address | Expected Flow |
| :--- | :--- | :--- |
| **Instant Success** | `success@razorpay` | Auto-approved in test checkout modal; instant redirect to ticket receipt. |
| **Bank Failure** | `failure@razorpay` | Immediate decline message: *"Payment was declined by your bank."* |
| **Pending / Timeout** | `pending@razorpay` | Simulates slow bank collect response. Checkout stays calm with status check. |

### C. Netbanking Simulation
- Select any supported Indian bank (e.g., HDFC Bank, ICICI Bank, State Bank of India, Axis Bank).
- Razorpay test modal loads the bank emulator page.
- Click **"Success"** to complete authorization or **"Failure"** to test error recovery.

---

## 3. Failure & Recovery Modes

1. **Card/UPI Decline:**
   - The user remains on `/checkout` with a clear explanation banner.
   - The 10-minute seat hold is **preserved**, allowing the user to select another payment method or card without losing their chosen seats.
2. **Modal Dismissal / Tab Abandonment:**
   - The user can return to `/checkout` as long as the countdown timer has not expired.
   - If the user explicitly abandons the flow, seats are cleanly returned to `AVAILABLE` upon hold expiry or by clicking "Change Seats".
3. **Paid-After-Expiry Edge Case:**
   - If network delay causes a payment confirmation to arrive after the seat hold has expired and been re-allocated, the verification endpoint returns `HTTP 410 Gone`.
   - The backend **automatically creates a 100% full refund record** (`Refund` entity with status `PROCESSED`) and displays a plain notice to the patron.
4. **Webhook Replays & Out-of-Order Delivery:**
   - All gateway webhooks require raw-body HMAC-SHA256 signature verification (`X-Razorpay-Signature`).
   - Every event ID is recorded in the `payment_events` table; replayed events are acknowledged with `duplicate_event_ignored` and never cause duplicate state mutations.

---

## 4. Cancellation & Refund Rules

- **Cancellation Window:** Cancellations are accepted up to 2 hours (120 minutes) prior to scheduled showtime.
- **Refund Ratio:** 75% refund of total booking amount per cinema policy (25% cancellation processing fee).
- **Seat Release:** Confirmed seats are atomically returned to `AVAILABLE` status upon cancellation.
- **Waitlist Notification:** Releasing seats automatically triggers the waitlist notification engine for queued patrons.

---

## 5. Summary of Automated vs Hand-Checked Flows

| Flow | Status | Automated Test Reference |
| :--- | :--- | :--- |
| Order Creation (server amount in paise) | Automated | `tests/test_phase5_payments.py::test_razorpay_order_creation_server_computed_amount` |
| HMAC-SHA256 Verification & Tampering Refusal | Automated | `tests/test_phase5_payments.py::test_razorpay_signature_validation_constant_time` |
| Webhook Replay & Idempotency (`payment_events`) | Automated | `tests/test_phase5_payments.py::test_payment_webhook_idempotency_and_duplicate_suppression` |
| Paid-After-Expiry 100% Automatic Refund | Automated | `tests/test_phase5_payments.py::test_paid_after_expiry_triggers_automatic_refund` |
| Cancellation & 75% Refund Calculation | Automated | `tests/test_phase5_payments.py::test_cancellation_and_refund_policy` |
| Per-seat Ed25519 QR Signing & Turnstile Verify | Automated | `tests/test_phase5_payments.py::test_signed_qr_ticket_roundtrip_verification` |
| CI Production Bypass Pattern Scan | Automated | `backend/scripts/ci_check_no_bypasses.py` |
| End-to-End Checkout UI & Ticket Lifecycle | Automated | `frontend/e2e/phase5_payments.spec.ts` |
| Responsive Layout at 390px, 768px, 1280px | Automated / Screenshots | `docs/evidence/phase-5/` |
