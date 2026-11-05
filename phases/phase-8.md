# Phase 8 — Hardening, performance, PWA, deployment

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-8/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_8_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 7 passed.

## Build-state check (read first)
Earlier build sessions did not follow this phase numbering strictly (see `docs/PROJECT_STATUS.md` and the latest audit). Before writing code, find out what already exists for this phase. If a feature exists, do NOT rebuild it: audit it against this prompt and `COMMON_RULES.md`, keep what passes, fix what fails, and list every item in the report as AUDITED-OK, FIXED or BUILT. Never mark something as built unless you ran it and have evidence.

## Goal
Production-readiness and honest numbers.

## Tasks
1. Load and concurrency tests (Locust or k6): browse load, hold storms on one showtime, webhook bursts. Fix hotspots (indexes, caching, query plans).
2. Security pass against OWASP ASVS: headers and CSP, rate limits, dependency audit, secrets scan, upload hardening, authorization review. Record findings and fixes.
3. 3D on real devices: measure on at least one mid-range Android phone and one iPhone if available, adjust quality tiers, document results (this decides the mobile-app approach).
4. Accessibility audit, Lighthouse budgets (non-3D pages LCP under 2.5 s on mid-range mobile).
5. PWA: manifest, service worker for static shell, offline ticket view.
6. Deployment: production Docker images, compose or deployment docs, Nginx config, migrations in release process, backups, monitoring and error tracking hooks, `.env` checklist, Razorpay live-mode checklist (not enabled).
7. Final documentation set and a release checklist.

## Tightening (added after review; these override the task list above where they conflict)
1. **Numeric targets** (record actual results): browsing at 500 concurrent virtual users with API p95 under 500 ms; a hold storm of 1,000 clients on one seat with exactly one winner and hold p95 under 800 ms; 2,000 WebSocket connections receiving updates within 2 seconds; a webhook burst of 200 per second processed idempotently; non-3D pages LCP under 2.5 s on a mid-range phone; 3D page p95 frame time under 16.7 ms on a mid-range desktop and at least 30 FPS on a mid-range phone. Missing a target is reported, not hidden.
2. **Measure the production build** (not the development server) for all performance numbers, and test on at least one real mid-range Android phone and one iPhone; if no device is available mark UNVERIFIED.
3. **Basic observability now** (pulled forward from Phase 16): structured logs with request ids, metrics and dashboards for funnel, hold conflicts, payment failures, webhook lag, sweeper health, database connections and slow queries, error tracking, and alerts with a short runbook.
4. **Failure drills now:** stop Redis (site degrades gracefully, bookings stay correct because PostgreSQL is the truth), restart the backend during a payment (reconciliation recovers it), delay and duplicate webhooks, drop a WebSocket (client resyncs). Record observed behaviour.
5. **Backups and restore:** automated encrypted backups and a restore drill with measured recovery time.
6. **Security pass:** everything in `SECURITY_SPEC.md` section 10, plus: no bypass strings anywhere in code or history, cookies flags checked in the browser, demo and default accounts removed or disabled for production, database roles least-privilege, secrets only from environment or secret store with startup validation that fails fast if missing, log scrubbing verified (no tokens, OTPs, card or phone data), production CSP verified against 3D, trailer video and Razorpay.
7. **Deployment from scratch:** build a staging environment on a clean machine from the docs, run migrations and a rollback, verify health endpoints and graceful shutdown of workers, and prove the app starts only with a valid configuration.
8. **Regression:** run `phases/audit-progress.md` in report-only mode at the end; no Critical or High findings may remain open.
9. **Launch readiness:** tick items in `LAUNCH_CHECKLIST.md` sections 3 to 5 with evidence, and list the human tasks that remain (legal, tax, KYC).
Add these tests/evidence: load reports against the numeric targets, failure drill logs, restore drill log, the audit report, ZAP and header scan outputs, Lighthouse for key pages, and real-device 3D results.

## Tests and evidence
Load-test reports, security report, Lighthouse and axe reports, full regression of every earlier phase.

## Security gate (see `SECURITY_SPEC.md`)
Run the full SECURITY_SPEC testing list: OWASP ZAP baseline, header scan, Trivy, dependency audits, gitleaks, abuse suite, ASVS L2 subset checklist, findings table with retests. Verify production CSP against 3D, trailer and Razorpay. Document go-live checklist.
Evidence in `docs/evidence/phase-8/security.md`; unresolved findings block the exit gate.

## Exit gate
All earlier suites green, load targets met or honestly reported, deployment docs verified from a clean machine.
