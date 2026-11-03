# CineVerse build runbook

## Order (changed from the earlier plan on purpose)
1. Foundation and data
2. **3D auditorium** (hardest and most important, so it is de-risked early)
3. Core site (browse and showtimes)
4. Booking engine (holds, live updates, checkout)
5. Payments and tickets
6. Accounts, profile, content, i18n
7. Admin and partner portals
8. Hardening and deployment
9. Voice agent (can start after Phase 5, ideally after Phase 6; must pass before final hardening sign-off if you want it in the first release)

10. Group booking: shared seat picking and split payment (after Phase 7)
11. Smart seats and pricing: best-seat engine, heatmap, view estimates, waitlist, dynamic pricing (after Phase 7)
12. Venue operations: onboarding tool, entry scanning, at-seat orders, membership, ticket transfer (after Phase 7)

Phases 10 to 12 are independent of each other; do them in the order that matters most to your launch. Run Phase 8 hardening again after any of them ships.

Mobile app comes after Phase 8, once 3D has been measured on real phones.

## Companion specs
Every session reads `DESIGN_SPEC.md` (layout, tokens, trailer player) and `SECURITY_SPEC.md`. Booking default is the **standard 2D seat map**; 3D opens from a button.

## How to run each phase
1. Open a new Antigravity session with the `cineverse-3d` folder as the repo.
2. Paste the full contents of `phases/phase-N.md`.
3. Let it work until it writes `docs/PHASE_N_REPORT.md` and stops.
4. Review the report and the evidence yourself. Open the running app and click through it.
5. Only start the next phase when every item is PASS. Otherwise paste the failures back into the same session and ask it to fix them.

## Rules that save you pain
- One phase per session. Long sessions drift; `docs/PROJECT_STATUS.md` carries the memory between sessions.
- Ask for evidence (test output, screenshots), not claims.
- Never share real Razorpay live keys with the tool; keep test keys in `.env` only.
- Commit to git after every passed phase so you can roll back.
- If a session ends mid-phase, start a new one with: "Read docs/PROJECT_STATUS.md and continue Phase N from where it stopped."

## docs/PROJECT_STATUS.md template (create this file now)
| Phase | Status | Report | Notes |
|---|---|---|---|
| 1 Foundation | not started | | |
| 2 3D auditorium | not started | | |
| 3 Core site | not started | | |
| 4 Booking engine | not started | | |
| 5 Payments and tickets | not started | | |
| 6 Accounts and content | not started | | |
| 7 Admin | not started | | |
| 8 Hardening | not started | | |
