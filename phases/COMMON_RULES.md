# CineVerse common rules (every phase must follow these)

These come from real problems found in earlier audits and screenshots. If a phase prompt and this file disagree, the stricter rule wins.

## 1. Evidence and honesty
1. "Done" means you ran it in the real app and have a screenshot or test output. Reports that say PASS without evidence will be rejected.
2. Test the running app, not just unit tests: start the stack the documented way and use Playwright against it. Save screenshots at 390, 768 and 1280 widths.
3. Report failures and gaps plainly (FAIL / PARTIAL / UNVERIFIED). Never weaken a test, hide a finding or skip a step to look finished.
4. No stubs presented as features. Anything not built is labelled "Coming soon", disabled, with a reason, and listed in the report.

## 2. Money and data correctness
5. **One source of truth for prices and categories: the server.** Every screen (2D map, 3D tooltip, seat card, legend, bottom bar, checkout, ticket, email, invoice) shows the same server-provided quote. No client-side price tables or row-to-category rules. A test compares them for every seat and several showtimes.
6. Money is integer paise. Totals are computed on the server. Never trust amounts, signatures or success flags sent by the browser.
7. **PostgreSQL is required** for booking correctness (row locks, unique constraint, concurrency tests). SQLite results do not count as proof.
8. No test-only bypass in production code (no special signatures, debug flags that skip verification). Tests create real signatures and real data.
9. Seat identity: map by `node_name`; seat 01 is on the audience's left; the 2D map, 3D scene, ticket and emails agree. A test covers all 100 seats.

## 3. Product principles
10. Simple and friendly: light, rich-colour theme; body text 18 px; nothing under 14 px; touch targets 48 px; one primary action per screen; extras collapsed; plain language (see `DESIGN_SPEC.md`).
11. The standard 2D seat map is the default; 3D opens from a "See it in 3D" button. Selection and holds are shared between 2D and 3D.
12. In 3D: hovering a seat shows its price; no boxes or heavy panels around seats; one compact tooltip, one docked card, never two for different seats; real full-screen mode; the movie's own trailer plays on the screen (poster fallback, never a blank slab).
13. Honest wording: viewing angles, comfort scores, line of sight and sound are estimates; never say "unobstructed", "guaranteed" or "100% visible". Reasons shown must match the score.
14. Dead or half-working buttons are bugs: fix or remove them.

## 4. Performance and quality
15. Measure before optimising; report p95 frame time, long tasks, input latency, draw calls and triangles, not only average FPS. Targets: p95 frame time under 16.7 ms on a mid-range desktop, 30 FPS on a mid-range phone, input-to-feedback under 100 ms.
16. Accessibility and contrast checks (axe, keyboard-only, reduced motion) on every new screen.

## 5. Security and process
17. Follow `SECURITY_SPEC.md`; every phase has a security gate with evidence.
18. One commit per logical part with a message, tests added with the change; tag only when the exit gate passes.
19. Keep earlier tests green; run the full suites at the start and end of every session; report counts.
20. Stop at each stop point and wait for review. Do not start the next phase.
21. Never put secrets or real payment keys in code, chat or screenshots.
