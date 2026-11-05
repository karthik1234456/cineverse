# Phase 14 — Immersive extras and accessibility: sound preview, guided tour, shareable views, VR (experimental)

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md` (light, simple, 18 px text, nothing under 14 px), `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Keep the product SIMPLE: every new feature must be optional, collapsed or clearly secondary, and must pass the simplicity budget in `DESIGN_SPEC.md`. Never mark an item done without evidence under `docs/evidence/phase-14/`. Diagnose failures, do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_14_REPORT.md` (PASS / FAIL / NOT DONE) and STOP for review.

**Entry gate:** Phase 2c passed (light UI, seats, per-movie trailer on the 3D screen) and Phase 4 passed.

## Goal
Make the 3D experience richer without making it harder to use, and make the whole booking journey accessible.

## Tasks
1. **"Hear it from here" (approximate sound preview, off by default):** play the movie's trailer audio through the Web Audio API with simple distance attenuation and left/right panning from the seat's position relative to the screen and speaker towers, plus a gentle generic room reverb. Label clearly: "Approximate preview, not a measurement of the real cinema's sound." Needs a user gesture, a volume control, and respects the muted-by-default rule.
2. **Guided 3D tour (30 seconds, skippable):** a smooth camera flythrough with plain captions ("Premium seats", "Best view", "Aisle seats", "Exit") shown once to first-time visitors and available from the help menu. Reduced-motion users get stepped stills instead.
3. **Compare seats side by side:** up to three seats with synchronised trailer playback, one-tap swap, and a plain verdict line ("Seat F6 sees more of the screen; Seat H6 is farther back"). One canvas only (no multiple WebGL contexts).
4. **Share my view:** capture an image from the seat POV (a canvas snapshot with the movie title, seat and showtime caption, no personal data) to share or save; invite link to the same showtime (builds on Phase 10 if present).
5. **Accessible seat finding:** accessible/companion seat rules in the data model and map, "Find wheelchair-accessible seats" shortcut, screen-reader descriptions of seats and rows (row, number, category, price, status, side of the room), full keyboard navigation of the 2D map, high-contrast mode, text size setting, captions on all trailers with a visible toggle, reduced-motion respect, and a "simple mode" that hides 3D and extras.
6. **VR / WebXR seat preview (EXPERIMENTAL, feature-flagged, off by default):** on supported headsets, enter the theatre in immersive mode with teleport movement and snap turning, comfort vignette, no smooth artificial locomotion by default, fixed seated view at the true eye position. Performance budget 72 FPS or the feature falls back to the normal view. Document supported devices tested; if no device is available, mark UNVERIFIED.
7. **Seat quality of life:** remember the last 3D mode, show a tiny "you are here" mini-map, "row and seat number" shown only on hover, quick jump to "centre of row E".

## Tests and evidence
Audio routing tests (panning sign matches left/right with the corrected seat numbering), tour skip and reduced-motion tests, compare view uses a single WebGL context, share image contains no personal data (metadata check), axe and keyboard-only runs on the seat page and 3D controls, screen-reader text snapshots, high-contrast and 200 percent zoom screenshots, WebXR feature-detect fallback test.

## Security gate (see `SECURITY_SPEC.md`)
Share links unguessable and showtime-scoped, no personal data in shared images, microphone not used, permissions only on explicit action, XR behind a flag with CSP intact.

## Exit gate
Everything is optional and off the main path; the standard booking journey is unchanged and still simple; accessibility checks pass; claims about sound and VR are honest.
