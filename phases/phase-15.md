# Phase 15 — Commerce and compliance: invoices, saved payment methods, gift cards, refunds tracker, bulk booking

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md` (light, simple, 18 px text, nothing under 14 px), `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Keep the product SIMPLE: every new feature must be optional, collapsed or clearly secondary, and must pass the simplicity budget in `DESIGN_SPEC.md`. Never mark an item done without evidence under `docs/evidence/phase-15/`. Diagnose failures, do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_15_REPORT.md` (PASS / FAIL / NOT DONE) and STOP for review.

**Entry gate:** Phase 5 passed (payments stable) and Phase 6 passed.

## Goal
Everything people expect from a ticketing service after the payment succeeds, with correct records.

## Tasks
1. **Invoices and receipts:** automatic PDF tax invoice per booking (our legal details, GSTIN placeholders as configuration, line items, taxes as configured rates, booking id) and a clear ticket/receipt split; email delivery; re-download from My Tickets. Tax rates and rules are configuration, not hard-coded, and must be reviewed by an accountant before launch (document this).
2. **Saved payment methods via the gateway only:** use Razorpay tokenisation (saved cards and UPI IDs held by the gateway; we store only the token reference and last four digits); one-tap rebooking; remove method; never store card numbers, CVV or raw UPI secrets. Add UPI intent/QR flow and wallet options where the gateway supports them.
3. **Refund tracker:** a simple "Where is my refund?" timeline (requested, processing, refunded) using gateway status and webhooks, with notifications; admin sees stuck refunds.
4. **Gift cards and promo credit:** purchasable and redeemable codes with balance ledger, expiry, one-time redemption, fraud limits, and partial redemption at checkout; ledger entries are append-only with audit.
5. **Bulk and corporate booking (simple form):** request 20+ seats or a private screening, goes to an admin queue with quote, approval and payment link; no changes to the simple customer journey.
6. **Cancellations and policy display:** cinema-specific cancellation windows and fees shown before paying (plain language), computed refund preview, one-tap cancel inside the allowed window, cancelled-booking records kept for accounting.
7. **Accounting exports for admin:** daily settlement report matching gateway payouts to bookings (reconciliation with mismatch flags), CSV exports, revenue by cinema/movie/day, refunds, taxes collected.
8. **Support basics:** contact form, booking lookup for support staff with role limits, canned replies, a log of customer-facing communications.

## Tests and evidence
Invoice numbering is sequential and gap-free under concurrency, totals reproduce from integer paise (no floats), tax configuration changes do not alter past invoices, tokenised-payment flow in test mode, no card data in logs or database (grep and schema test), refund timeline state tests with duplicate and out-of-order webhooks, gift card ledger invariants (balance never negative, redemption is atomic, double redemption fails), reconciliation test with an intentionally mismatched payout, authorisation tests for support and finance roles.

## Security gate (see `SECURITY_SPEC.md`)
PCI scope kept minimal (hosted checkout and tokens only), ledger tamper evidence, finance endpoints MFA step-up, PII minimisation in exports, access logging for invoice downloads.

## Exit gate
Every paid booking has a correct downloadable invoice, refunds are traceable end to end, and daily reconciliation passes on test data.
