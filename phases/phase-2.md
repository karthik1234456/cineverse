# Phase 2 — The 3D auditorium experience (highest-risk phase, built early on purpose)

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-2/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_2_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Phase 1 passed (frontend runs, GLB and seat layout available from the API or static files).

## Goal
The signature feature, working end to end on seat data from the backend (mock-status endpoint allowed only if Phase 1 inventory is not ready, and it must be clearly marked).

## Tasks
Implement **everything in `ANTIGRAVITY_PROMPT.md`** with these notes:
- Verify coordinates at startup by comparing each seat node's world-space bounds against the layout JSON (fail loudly in dev).
- Orbit, zoom, pan with a clamp so the camera never leaves the room; seat clicking via invisible proxy boxes; states available / booked / held / selected with colour plus a second non-colour cue.
- **First-person Walk mode and Seated POV exactly as specified in section 5b of `ANTIGRAVITY_PROMPT.md`** (arrow keys / WASD, mouse look with pointer lock, touch joystick, collision from `walk_nav_v2.json`, tier following, sit and stand, Q/E/Z/X seat navigation). Treat it as part of this phase's exit gate.
- Seat POV at the eye position with `lookAt(screen centre)`; smooth, interruptible transitions using quaternion slerp and a path that rises above the rows; previous/next seat and row navigation.
- Info panel: distance (units and approximate metres), horizontal offset, vertical angle, screen field of view, geometric screen coverage, category, price. Include the "How is this calculated?" popover and the honesty wording. Never say "unobstructed".
- Compare up to 3 seats using one canvas.
- Performance: measure first, create the optimised web GLB (keep the original), LOD if POV quality suffers, demand rendering, quality tiers. Record before and after numbers.
- **Trailer on the cinema screen per section 5c of `ANTIGRAVITY_PROMPT.md`** (video texture, fit, controls, spill light, fallbacks, single media element).
- Realism: lighting rig, house-lights modes, screen content overlay, haze and dust (tier-gated).
- Desktop panels and mobile bottom sheet, keyboard and reduced-motion support, WebGL-unavailable fallback.

## Tests and evidence
Follow section 9 of `ANTIGRAVITY_PROMPT.md`: Vitest fixtures (row A centre about 97.7 degrees, row E about 62.6, row J about 42.0), mapping test for all 100 nodes, Playwright with SwiftShader assertions through `window.__cineverse`, screenshots of POV from A05, E05 and J10, mobile touch tests, performance table.

## Security gate (see `SECURITY_SPEC.md`)
Production CSP must still allow the 3D viewer (blob workers) and the trailer video (CORS, `media-src`). GLB/video loaded only from allow-listed origins. No secrets or tokens in the 3D debug hook outside dev. Test WebGL-disabled and CORS-failure fallbacks.
Evidence in `docs/evidence/phase-2/security.md`; unresolved findings block the exit gate.

## Exit gate
Trailer plays on the screen in Overview, Walk and Seated modes with evidence (two frames showing motion). The first-person walk and seated tests in section 5b pass (movement, collisions, tiers, sit/stand, exact eye positions). All nine priorities in that prompt PASS with evidence, or are listed honestly as failing. Do not move on while seat POV or mapping fails.
