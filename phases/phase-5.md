# Phase 5 — Payments (Razorpay test mode), tickets, notifications

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-5/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_5_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 4 passed.

## Goal
A paid booking becomes a confirmed booking with a QR ticket, safely.

## Tasks
1. `create-order` (server-side, amount computed on the server, never from the client), checkout with Razorpay test keys from env only, `verify` with server-side signature validation, `webhook` with signature check, **idempotency table `payment_events`**, out-of-order and duplicate events handled.
2. State machine: HELD to PAYMENT_PENDING to BOOKED atomically; payment failure returns seats to AVAILABLE; paid-after-expiry triggers automatic refund and a user notice; reconciliation job for stuck PAYMENT_PENDING.
3. Cancellation and refund rules by cinema policy; refund API (test mode).
4. Tickets: signed QR payload, ticket page, PDF download (ReportLab or similar), printable view, `.ics` calendar file, share link; ticket verification endpoint for staff scanning.
5. Notifications behind provider interfaces: email (Mailpit in dev), SMS/WhatsApp mock provider.
6. Never trust frontend success callbacks; the UI polls booking status.

## Tests and evidence
Signature tests (valid, tampered, replayed), webhook duplicate and out-of-order, paid-after-expiry refund path, failure path, full Playwright journey with Razorpay test card and UPI, QR round-trip verify. Document the test keys steps without committing secrets.

## Security gate (see `SECURITY_SPEC.md`)
Signature verification with constant-time compare, webhook replay and forged-signature tests, amount/currency/order cross-checks, no card data anywhere, key secrets only in server env, signed single-use QR with rotation, scanner endpoint role and rate limits, refund endpoints admin-only with audit log.
Evidence in `docs/evidence/phase-5/security.md`; unresolved findings block the exit gate.

## Exit gate
Complete journey from the website prompt section 15 works end to end in test mode, with evidence.
