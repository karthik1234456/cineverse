# Phase 17 — Mobile app (Expo React Native) for Android and iOS

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md` (light, simple, 18 px text, nothing under 14 px), `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Keep the product SIMPLE: every new feature must be optional, collapsed or clearly secondary, and must pass the simplicity budget in `DESIGN_SPEC.md`. Never mark an item done without evidence under `docs/evidence/phase-17/`. Diagnose failures, do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_17_REPORT.md` (PASS / FAIL / NOT DONE) and STOP for review.

**Entry gate:** Phases 1 to 8 passed and a measured 3D performance report on real mid-range phones exists (Phase 8). Website stable.

## Goal
A simple, fast app with the same booking flow, native tickets and push notifications, reusing the existing API.

## Tasks
1. **Foundation:** Expo (React Native, TypeScript), shared API client generated from the OpenAPI schema, shared domain code where practical (price formatting, seat-map layout, validation) in a small shared package, light theme tokens from `DESIGN_SPEC.md`, 18 px base text, 48 px touch targets, navigation with four tabs (Home, Movies, Tickets, Profile).
2. **Auth and security:** sign in with email/phone OTP, tokens in secure storage (Keychain/Keystore), refresh rotation, biometric unlock option, no secrets in the bundle, certificate and TLS defaults verified, jailbreak/root detection only as a risk signal, deep links validated.
3. **Booking flow:** city, movie, showtime, **2D seat map first**, add-ons, review, **Razorpay native SDK in test mode**, live seat updates over WebSocket, hold timer, and the same server-side rules as the web.
4. **3D theatre:** first deliver it as a full-screen WebView of the existing 3D route using the measured quality tiers (Low by default on weak devices), with the trailer on the screen and the hover/tap price tooltip; selection state shared with the native seat map. Evaluate native 3D only if the WebView result fails the performance targets (30 FPS on the target mid-range phone), and record the decision with numbers.
5. **Tickets:** offline-capable tickets with the signed QR (the same format as the web), brightness boost on the QR screen, add to Apple Wallet and Google Wallet (signed passes), calendar add, share, and a "Directions" button.
6. **Push notifications:** device token registration, booking confirmation, show reminders, waitlist and refund updates, quiet hours and per-type opt-out; notification content contains no sensitive data.
7. **Quality:** accessibility (screen reader labels, dynamic type, reduced motion), localisation (English, Hindi, Kannada), crash and performance monitoring, app size under a stated budget, slow-network behaviour, store-compliance checklist (privacy labels, data safety form, payments policy, account deletion in app).
8. **Release engineering:** EAS builds, environments (dev, staging, production), signing handled outside the repo, CI running lint, type-check, unit tests and end-to-end tests (Maestro or Detox) on emulators, staged rollout plan.

## Tests and evidence
End-to-end test of the full booking journey on an Android emulator and an iOS simulator (or UNVERIFIED if unavailable), measured 3D frame rates on at least one real mid-range Android phone, offline ticket test (airplane mode), push test in staging, wallet pass validation, security checklist (secure storage, no tokens in logs, deep link abuse tests), accessibility audit, bundle size report.

## Security gate (see `SECURITY_SPEC.md`)
Mobile verification items above plus: API access identical to the web authorisation rules, no admin features in the customer app, device sessions listed and revocable, push tokens deleted on logout, no payment credentials stored.

## Exit gate
A person can install the app, book seats in 2D or 3D, pay in test mode, and show an offline QR ticket and wallet pass, with measured performance honestly reported.
