# Phase 16 — Scale, reliability and growth tools: waiting room, observability, feature flags, experiments

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md` (light, simple, 18 px text, nothing under 14 px), `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Keep the product SIMPLE: every new feature must be optional, collapsed or clearly secondary, and must pass the simplicity budget in `DESIGN_SPEC.md`. Never mark an item done without evidence under `docs/evidence/phase-16/`. Diagnose failures, do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_16_REPORT.md` (PASS / FAIL / NOT DONE) and STOP for review.

**Entry gate:** Phases 1 to 8 passed. Run before any big marketing push or blockbuster release.

## Goal
Survive a popular release day and learn from real usage without risking money or seats.

## Tasks
1. **Virtual waiting room** for hot showtimes: when demand exceeds a configurable threshold, new arrivals get a fair signed queue token (first come first served, position and estimated wait shown in plain language), admitted in batches to the seat page; protection against queue jumping, token sharing and bots (per-IP and per-account limits, optional CAPTCHA); the queue never touches booking correctness (holds still go through the Phase 4 engine).
2. **Observability:** structured logs with request ids, metrics and traces (OpenTelemetry), dashboards for the booking funnel (view, hold, pay, confirmed), hold success and conflict rates, payment failure reasons, webhook lag, WebSocket connections, DB locks and slow queries, Redis health, Core Web Vitals; error tracking; alerts with sensible thresholds and runbooks (payment failures spike, webhook signature failures, hold sweeper stalled, DB connection exhaustion).
3. **Resilience tests (chaos-lite):** stop Redis (the site degrades gracefully, bookings remain correct because PostgreSQL is the truth), restart the backend during payments (reconciliation recovers), delay webhooks, drop the WebSocket (clients reconcile), fill the disk on logs (non-fatal), DB failover test if replicated. Document expected behaviour and observed results.
4. **Capacity and performance:** load tests (k6 or Locust) for browsing, search, hold storms on one showtime, webhook bursts, WebSocket fan-out to thousands of clients; caching strategy (CDN for static and media, Redis for read-heavy lists with explicit invalidation), connection pooling, query plans reviewed, autoscaling guidance, a stated capacity target and results against it.
5. **Feature flags and safe rollout:** server-side flags with percentage rollout and kill switches for 3D extras, voice agent, dynamic pricing, group booking, transfers; flag changes audited; every risky feature can be disabled without a deploy.
6. **Experiments (consent aware, simple):** A/B tests for non-price UI choices (for example button wording, step order), with guardrail metrics (conversion, errors, payment failures); no experiments on prices, fees or availability; results dashboard in admin.
7. **Backups and recovery:** automated encrypted backups, a tested restore drill with measured recovery time, migration rollback plan, incident response checklist.

## Tests and evidence
Load-test reports against stated targets, a waiting-room fairness test (order preserved, no duplicate admission, token tampering rejected), chaos scenarios with before/after behaviour, alert fire drills, flag kill-switch test, restore drill log. Dashboards screenshotted with real test traffic.

## Security gate (see `SECURITY_SPEC.md`)
Queue tokens signed and short-lived, observability data scrubbed of PII and secrets, flag and experiment admin actions need role and MFA, rate limits unchanged under load, backups encrypted and access-controlled.

## Exit gate
The documented capacity target is met, failure drills pass, and every risky feature has a working kill switch.
