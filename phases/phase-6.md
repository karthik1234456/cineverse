# Phase 6 — Accounts, profile, reviews, offers, content, i18n, SEO

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-6/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_6_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 5 passed.

## Build-state check (read first)
Earlier build sessions did not follow this phase numbering strictly (see `docs/PROJECT_STATUS.md` and the latest audit). Before writing code, find out what already exists for this phase. If a feature exists, do NOT rebuild it: audit it against this prompt and `COMMON_RULES.md`, keep what passes, fix what fails, and list every item in the report as AUDITED-OK, FIXED or BUILT. Never mark something as built unless you ran it and have evidence.

## Goal
Everything around the booking that makes it a real product.

## Tasks
1. Auth: register, login, email verification, password reset, phone-OTP login through a provider interface (mock in dev), rotating refresh tokens in httpOnly cookies, CSRF, brute-force protection, roles (customer, cinema_manager, support, admin). Guest checkout rules decided and documented.
2. Profile: details, bookings (upcoming, past, cancelled) with ticket download and cancel, watchlist, preferences (city, language, format, preferred rows or categories used to suggest seats in 3D), notifications, loyalty points ledger, data export and account deletion.
3. Reviews and ratings with moderation and spoiler tags, "I'm interested" votes, recommendations for the home page.
4. Offers page, referral code basics, FAQ and help centre, contact form, policy pages, cookie consent suited to India's DPDP rules.
5. i18n with English, Hindi and Kannada string files, INR and IST formatting, sitemap, robots, canonical URLs.

## Tightening (added after review; these override the task list above where they conflict)
1. **Keep it simple:** browsing never needs an account; an account is needed at the moment of holding seats ("Continue" on the seat page). Offer phone OTP and email plus password, nothing else for now (no social login). The profile has only Tickets (Upcoming, Past, Cancelled), Preferences (city and language) and Account/Security. **Defer** loyalty points, referral codes and recommendations to later phases (12, 13, 15) so this phase stays small.
2. **Reviews:** star rating plus a short review, one per user per movie, allowed only for users with a completed booking for that movie ("Verified booking" badge), spoiler tag, report button, moderation queue, rate limits. "I'm interested" votes are optional and simple.
3. **Auth hardening in practice:** Argon2id, uniform error messages, refresh rotation with reuse detection, session list with revoke, email verification and password reset tested end to end through the local mail catcher, OTP through a provider interface (mock only in development; production uses a real provider and the DLT requirements for India are noted in the docs), CAPTCHA behind an interface after anomalies, TOTP mandatory for admin and manager accounts, CSRF protection. No third-party scripts on login or checkout pages.
4. **Languages:** English complete; Hindi and Kannada for the whole booking journey and the main pages, marked UNVERIFIED until a native speaker reviews them; use fonts with proper Indic script support, check layouts with longer strings, keep the 14 px minimum, never auto-translate legal text.
5. **Policies:** Terms, Privacy, Refund and Cookie pages exist as clearly marked drafts ("legal review required before launch"), with a simple consent banner that records consent and lets people change it; DPDP data export and deletion work and are tested.
6. **Authorisation proof:** a generated matrix test hits every protected route as anonymous, customer, another customer, staff and admin and compares to the expected result; IDOR tests for bookings, tickets, profiles, payments and reviews.
Add these tests: guest can browse but cannot hold; verified-booking-only reviews; token reuse revokes the family; OTP throttles; deletion removes personal data but keeps legally required booking records in anonymised form; locale smoke tests; axe and keyboard runs on auth and profile pages.

## Tests and evidence
Authorization matrix tests (every protected route, ownership checks), token rotation and reuse detection, OTP rate limits, review moderation, i18n smoke tests per locale, axe accessibility checks on key pages.

## Security gate (see `SECURITY_SPEC.md`)
Argon2id, refresh rotation with reuse detection, TOTP for admin and managers, OTP throttles and SMS budget cap, uniform auth errors, CAPTCHA after anomalies, CSRF, session list/revoke, DPDP export/delete flows, AuthZ matrix and IDOR test suites.
Evidence in `docs/evidence/phase-6/security.md`; unresolved findings block the exit gate.

## Exit gate
No route accessible without proper role or ownership, profile journey passes in Playwright.
