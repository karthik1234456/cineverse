# Phase 6 — Accounts, profile, reviews, offers, content, i18n, SEO

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-6/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_6_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 5 passed.

## Goal
Everything around the booking that makes it a real product.

## Tasks
1. Auth: register, login, email verification, password reset, phone-OTP login through a provider interface (mock in dev), rotating refresh tokens in httpOnly cookies, CSRF, brute-force protection, roles (customer, cinema_manager, support, admin). Guest checkout rules decided and documented.
2. Profile: details, bookings (upcoming, past, cancelled) with ticket download and cancel, watchlist, preferences (city, language, format, preferred rows or categories used to suggest seats in 3D), notifications, loyalty points ledger, data export and account deletion.
3. Reviews and ratings with moderation and spoiler tags, "I'm interested" votes, recommendations for the home page.
4. Offers page, referral code basics, FAQ and help centre, contact form, policy pages, cookie consent suited to India's DPDP rules.
5. i18n with English, Hindi and Kannada string files, INR and IST formatting, sitemap, robots, canonical URLs.

## Tests and evidence
Authorization matrix tests (every protected route, ownership checks), token rotation and reuse detection, OTP rate limits, review moderation, i18n smoke tests per locale, axe accessibility checks on key pages.

## Security gate (see `SECURITY_SPEC.md`)
Argon2id, refresh rotation with reuse detection, TOTP for admin and managers, OTP throttles and SMS budget cap, uniform auth errors, CAPTCHA after anomalies, CSRF, session list/revoke, DPDP export/delete flows, AuthZ matrix and IDOR test suites.
Evidence in `docs/evidence/phase-6/security.md`; unresolved findings block the exit gate.

## Exit gate
No route accessible without proper role or ownership, profile journey passes in Playwright.
