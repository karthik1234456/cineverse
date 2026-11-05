# Phase 5 — Payments (Razorpay test mode), tickets, notifications

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-5/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_5_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 4 passed.

## Build-state check (read first)
Earlier build sessions did not follow this phase numbering strictly (see `docs/PROJECT_STATUS.md` and the latest audit). Before writing code, find out what already exists for this phase. If a feature exists, do NOT rebuild it: audit it against this prompt and `COMMON_RULES.md`, keep what passes, fix what fails, and list every item in the report as AUDITED-OK, FIXED or BUILT. Never mark something as built unless you ran it and have evidence.

## Goal
A paid booking becomes a confirmed booking with a QR ticket, safely.

## Tasks
1. `create-order` (server-side, amount computed on the server, never from the client), checkout with Razorpay test keys from env only, `verify` with server-side signature validation, `webhook` with signature check, **idempotency table `payment_events`**, out-of-order and duplicate events handled.
2. State machine: HELD to PAYMENT_PENDING to BOOKED atomically; payment failure returns seats to AVAILABLE; paid-after-expiry triggers automatic refund and a user notice; reconciliation job for stuck PAYMENT_PENDING.
3. Cancellation and refund rules by cinema policy; refund API (test mode).
4. Tickets: signed QR payload, ticket page, PDF download (ReportLab or similar), printable view, `.ics` calendar file, share link; ticket verification endpoint for staff scanning.
5. Notifications behind provider interfaces: email (Mailpit in dev), SMS/WhatsApp mock provider.
6. Never trust frontend success callbacks; the UI polls booking status.

## Tightening (added after review; these override the task list above where they conflict)
1. **Amount integrity:** the order amount always equals the locked quote of the hold; the browser never supplies an amount. Tests: tampered amount, tampered currency, order for a different hold, order after the hold expired, and cross-checking the gateway's reported amount against ours before confirming.
2. **Checkout behaviour:** one clear Pay button, disabled after the first click; creating an order twice for the same hold returns the same order (idempotent); the hold timer is extended once a payment attempt has started (up to a configured maximum) so a person who is paying is not punished; plain messages for processing, success, failed and cancelled; UPI collect requests can stay pending for minutes, so show a calm waiting state with a way to come back.
3. **Recovery paths:** if the person closes the tab or loses connection mid-payment, the booking is recoverable from My Tickets as "Payment pending" until it resolves, the webhook completes it, and a reconciliation job asks the gateway about anything pending longer than a configured time. Paid-after-expiry is refunded automatically with a plain notice.
4. **Webhooks:** verify the signature over the raw body, respond quickly, process asynchronously with retries and a dead-letter record, ignore duplicates and out-of-order events using the `payment_events` table, alert on repeated signature failures or processing errors.
5. **Tickets:** one signed ticket (QR) **per seat** so groups and later transfers work; Ed25519 signatures with a key id and rotation; no personal data in the QR; scanner endpoint single-use with atomic state change; tickets revoked on cancellation or refund; ticket page and PDF readable at arm's length on a phone; works offline after first load; `.ics` and a share link that does not expose other people's data.
6. **Receipts stored for later invoices:** keep line items (tickets, fee, taxes, discount, add-ons) per booking in integer paise so Phase 15 can generate compliant invoices.
7. **Refunds:** policy-driven (cinema-specific window and fee rules shown before paying), refund status tracked from gateway webhooks, shown to the user in plain language, visible to admins.
8. **Notifications:** confirmation email and SMS provider interfaces with retries and de-duplication; content shows the same seat labels and times as the app and contains no sensitive data beyond what is necessary.
9. **No bypasses:** add a CI check that fails if any test-only signature, debug flag or "skip verification" branch exists in production code (search the code and fail the build on known patterns); tests generate real signatures with the test secret.
10. **Test mode instructions** in `docs/payments-test-mode.md` (keys in env only, test cards and UPI IDs, how to simulate failure), never committing secrets. Say clearly in the report which payment flows were automated and which were checked by hand.
Add these tests: the amount tampering set, idempotent create-order, pending-payment recovery, webhook duplicate/out-of-order/forged, paid-after-expiry refund, QR per seat verify and replay, revocation after refund, offline ticket display.

## Tests and evidence
Signature tests (valid, tampered, replayed), webhook duplicate and out-of-order, paid-after-expiry refund path, failure path, full Playwright journey with Razorpay test card and UPI, QR round-trip verify. Document the test keys steps without committing secrets.

## Security gate (see `SECURITY_SPEC.md`)
Signature verification with constant-time compare, webhook replay and forged-signature tests, amount/currency/order cross-checks, no card data anywhere, key secrets only in server env, signed single-use QR with rotation, scanner endpoint role and rate limits, refund endpoints admin-only with audit log.
Evidence in `docs/evidence/phase-5/security.md`; unresolved findings block the exit gate.

## Exit gate
Complete journey from the website prompt section 15 works end to end in test mode, with evidence.
