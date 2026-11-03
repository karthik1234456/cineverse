# Phase 8 — Hardening, performance, PWA, deployment

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-8/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_8_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 7 passed.

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

## Tests and evidence
Load-test reports, security report, Lighthouse and axe reports, full regression of every earlier phase.

## Security gate (see `SECURITY_SPEC.md`)
Run the full SECURITY_SPEC testing list: OWASP ZAP baseline, header scan, Trivy, dependency audits, gitleaks, abuse suite, ASVS L2 subset checklist, findings table with retests. Verify production CSP against 3D, trailer and Razorpay. Document go-live checklist.
Evidence in `docs/evidence/phase-8/security.md`; unresolved findings block the exit gate.

## Exit gate
All earlier suites green, load targets met or honestly reported, deployment docs verified from a clean machine.
