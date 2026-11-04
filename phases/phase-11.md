# Phase 11 — Smart seats and pricing: best-seat engine, comfort heatmap, view estimation, waitlist, dynamic pricing

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md`, `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence under `docs/evidence/phase-11/`. Diagnose and fix failures; do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_11_REPORT.md` (PASS / FAIL / NOT DONE table), then STOP for review.

**Entry gate:** Phases 1 to 7 passed (3D and booking engine working).

## Goal
Help people pick a good seat quickly and honestly, and give operators transparent, safe pricing tools.

## Tasks
1. **Seat scoring engine** (`lib` + backend, same maths, tested against each other): per seat from `seat_layout_v2.json` use distance to screen, horizontal and vertical viewing angles, screen field of view and side offset. Thresholds are **configurable defaults** based on commonly cited guidance (for example a comfortable horizontal field of view around 30 to 40 degrees, with uncomfortably wide views near the front) and are labelled as general guidance, not a cinema standard or measurement. Output a 0 to 100 "viewing comfort" score plus short reasons ("a little close", "slightly off-centre"). Preferences: centre view, "sit back", aisle, accessible, "no neck strain".
2. **Best available for N people:** adjacent seats, same row, category-aware, avoids leaving single orphan seats, explains its choice. Available in the 2D map, the 3D theatre and the voice agent (same service).
3. **Comfort heatmap** toggle in 2D and 3D (colour ramp plus pattern/number so it is colour-blind safe), with a legend that states it is an estimate.
4. **View obstruction estimate (clearly labelled "estimate, no audience modelled")**: raycast from the eye position to a grid of points across the screen against static geometry only (seats and rows ahead, rails, speaker towers, walls) using simplified collision boxes; report percentage of the screen visible and what blocks it. Compute offline per seat and store/cache it; recompute when the model version changes. Never claim a view is unobstructed; heads of other people are not modelled and the wording must say so.
5. **Waitlist / notify me:** when a sold-out or nearly full show frees seats (cancellation or hold expiry) notify subscribers fairly (first come, limited claim window, rate-limited, opt-out).
6. **Dynamic pricing (rules-based, transparent):** admin-defined rules (time before show, occupancy bands, weekday/weekend, format) with hard floor and ceiling, an approval step, a preview simulation, audit log, and a visible final price before checkout. **No per-user or personal-data-based pricing.** Price changes never affect seats already held or booked.
7. **Admin insights:** occupancy forecast per show (simple, explainable model such as historical average by weekday/time/genre with confidence range, not a black box), demand alerts, revenue impact preview of price rules.

## Tests and evidence
Unit tests on score fixtures (front row centre vs back row centre vs far side), property tests (score decreases when moving far off-centre), best-available edge cases (odd party sizes, fragmented rows, accessibility needs), obstruction results compared against hand-computed cases, cache invalidation on model version change, waitlist fairness and race tests, pricing bounds and approval workflow tests, a test that no user attribute enters price calculation. Screenshots of heatmaps in 2D and 3D.

## Security gate (see `SECURITY_SPEC.md`)
Waitlist abuse limits, admin-only pricing endpoints with MFA step-up and audit, price integrity (server computed, signed quote reused at checkout), no leakage of other users' preferences.

## Exit gate
Scores, heatmap and obstruction estimates are reproducible, labelled honestly, and consistent between frontend and backend; pricing rules cannot exceed their bounds under test.