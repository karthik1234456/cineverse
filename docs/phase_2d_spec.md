<USER_REQUEST>
# Phase 2d — 3D theatre: fix what is broken, declutter, real lighting and realism, friendly controls

> **Session preamble:** You are building CineVerse. First read `phases/COMMON_RULES.md` (mandatory rules for every phase), `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md`, `SECURITY_SPEC.md`, `docs/PROJECT_STATUS.md` and the latest phase reports. Do ONLY this task. Run every existing suite first (backend, Vitest, `tsc --noEmit`, Playwright) and keep them green. Previous reports claimed PASS while the problems below were visible in the running app, so this time **nothing counts as fixed unless a screenshot or test from the real running app proves it**. Save evidence in `docs/evidence/phase-2d/`. Write `docs/PHASE_2D_REPORT.md` with a table of every finding F1 to F14 (reproduced yes/no, fixed yes/no, evidence file). Commit each Part separately. Stop for review at the two stop points marked below.

The owner's screenshots of the running app (`/cinemas/1/auditorium/1?showtime=1&mode=3d`) are in `docs/evidence/phase-2d/reported/` (reported-1 walk mode seat D02, reported-2 overview seat I01 and D03, reported-3 tooltip for C06). If they are missing, ask the owner to add them. The findings below are written out in full so they can be reproduced without the images.

## Findings to reproduce and fix

**F1 (Critical, money): prices disagree inside the same screen.** Seat D02 shows ₹250 in the small tooltip and ₹380 in the large card at the same moment. The legend says Premier ₹520, but seat I01 shows ₹350. The left legend says Front = rows A–B, Prime = C–H, Premier = I–J, yet seat C06 is labelled FRONT ₹280, and D03 Prime shows ₹380. At least two price sources and two category mappings exist in the client.
**F2: category bands differ** between the legend, the seat label and the original seed (A–C / D–G / H–J).
**F3: the trailer does not appear on the screen.** The control bar says "Quantum Odyssey: Bey… Pause" (so it claims to be playing) but the screen is a flat grey slab.
**F4: the room is a black void.** Walls, floor and ceiling are almost invisible, "Lights up" changes nothing visible, thin gold bars float in space, the screen floats in darkness.
**F5: seats are congested and blocky.** In Overview the seats read as chunky flat orange/blue/red cubes that overlap each other, with many orange dot markers and small "x" badges on top. Rows cannot be distinguished.
**F6: the Walk-mode seat card is gigantic** (about a third of the screen, text sized like a poster, wrapped words), while the Overview panels use tiny text (below 14 px). Two seat cards about different seats are visible at once (a tooltip card and a docked panel).
**F7: toolbar overload:** Overview, Walk Mode, Seated POV, Default, Front, Back, Aerial, four FOV buttons and Heatmap all sit in one bar.
**F8: not a real full-screen experience:** the site header and footer stay visible, the selected-seats bar is partly hidden behind the controls hint bar (a stray white box and a cut-off red button at the bottom left), and the voice button overlaps other overlays.
**F9: the "Tap to turn sound on" control is broken:** a narrow dark pill with the text broken one word per line, floating mid-scene.
**F10: dishonest or contradictory wording:** "100% line of sight" and "100% visible" read as obstruction claims; a comfort score of 98.1 is shown with the reason "off to the side of the screen"; the Walk card prints "No audience modelled" as a caption to a 100% claim.
**F11: lag and jank** are reported although an external FPS counter shows 144 to 220, so average FPS is not the problem. Suspects: React re-rendering the large cards on every pointer move, per-frame raycasts, allocation and garbage-collection spikes, video texture uploads, post-processing, hundreds of separate draw calls, long tasks while loading the model.
**F12: "functions are not working properly"** (details unknown). Treat as: some buttons or interactions silently fail. Part B finds them all.
**F13: seat geometry looks over-simplified.** Check which seat asset is loaded (original, optimised web GLB, LOD or a premium seat) and whether the simplification destroyed the silhouette (curved backrest, armrests).
**F14: Walk mode starts looking into a dark, empty corridor with nothing readable.**

## Part A: one source of truth for price and category (do this first)
- The server alone decides each seat's category and price for a showtime and returns it in one quote object per seat (seat id, category, price, currency, and a quote id/version if prices can change). **Every** place that shows a seat price or category must use it: 2D map, 3D hover tooltip, seat card, legend, selected-seats bar, checkout summary, ticket and email. Delete all client-side price tables and row-to-category rules.
- Find out why F1/F2 happened (which phase changed prices or categories, stale constants, a second hard-coded table) and explain it in the report. Decide the category bands once (data in the database), and show the legend from the same data.
- Test: for every one of the 100 seats and at least two showtimes, assert the same price and category in all components above (API response, 2D map cell, 3D tooltip text, seat card, bottom bar, checkout line, ticket). A mismatch fails the build. Include a test for the exact examples above (D02, I01, C06, D03).

## Part B: functional QA, fix or remove everything that does not work
Build a table of every control and interaction on the 3D page, with expected behaviour, an automated Playwright test and the result. At minimum: hover tooltip, click to select, click again to deselect, selecting a taken or held seat (rejected with a friendly message), eight-seat limit, Sit down (E / Enter / click), Seated POV and exact eye position, previous/next seat and row, Stand up and return to Walk, Overview/Walk/Seated switching, view presets, FOV, Heatmap on/off, row jump buttons, compare, trailer play/pause/mute/sound, Lights up/Show, quality setting, pointer lock enter/exit/resume, keyboard movement and turning, Esc behaviour, 2D ↔ 3D shared selection, hold timer, Lock & Checkout, browser back, window resize, mobile touch controls. Any control that does nothing must be fixed or removed (no dead buttons). Report the table with pass/fail and evidence.

## Part C: make the trailer actually show on the screen
Debug in this order and record the result of each step: (1) confirm the video element really plays (time advances, no autoplay block, muted before play, plays inline); (2) prove frames exist by drawing the video to a scratch 2D canvas; (3) put a solid bright colour on the screen overlay and look at it from Overview, Walk and several seats to prove the overlay plane is placed correctly, faces the audience (the audience is at negative Z, seats face +Z, so the plane must face the audience and not be back-face culled) and is not hidden behind or fighting the original screen surface at distance; (4) enable the video texture with correct colour space and update on each new frame, including while rendering on demand; (5) check the console for texture upload or cross-origin errors; (6) check streaming/HLS loading and that the file for that showtime's movie exists and matches the movie. The trailer must be of that showtime's movie. If it cannot play, the screen must show the movie poster with a clear message, never a blank grey slab, and the control bar must not say "Pause" while nothing plays.
- Move "Tap for sound" into the trailer control cluster as a proper button (readable, one line, at least 14 px text, accessible name) and remove the broken floating pill.
- Screen brightness: visible detail, no pure white clipping, a soft glow and light spill that follows the video colours.
- Acceptance: from Overview, from Walk at row E and from Seated A05 and J10 the screenshots show visibly different video frames over time (compare two frames 2 seconds apart), for three different movies, plus a phone viewport.

**STOP 1.** After Parts A, B and C: commit, write the first half of the report with evidence and wait for review.

## Part D: performance and lag
Measure before changing anything, and report p50/p95/p99 frame time, long tasks over 50 ms, input-to-visual latency (pointer move to tooltip change; click to selection change), draw calls, triangles, texture memory and JS heap over a 60-second scripted interaction (hover sweep across all rows, orbit, walk, sit, switch modes), on desktop and with 4× CPU throttling, using Chrome performance traces and the React profiler. Then fix what the traces show. Required directions, adapted to what you measure:
- Hover and pointer handling: raycast only when the pointer moved, at a capped rate, against the invisible proxy boxes only; hover state kept out of React render paths (no re-rendering of cards or the 3D tree on every move); tooltip positioned with transient updates.
- Merge the static room meshes by material into a handful of draw calls; use instancing for repeated parts and for any state markers; frustum culling on; no per-frame object or array allocation; dispose of unused resources; avoid layout thrash from DOM overlays.
- Video texture at a sensible resolution (720p, 480p on mobile/low tier), updated only on new frames and only while the screen is visible; one video element.
- Post-processing limited to what is visible and gated by quality tier; shadows limited to one key light; render on demand when idle.
- Model loading: progressive load with a friendly progress screen, compressed assets, no main-thread stall after the model arrives (parse off the main thread where possible).
- Targets: p95 frame time under 16.7 ms on a mid-range desktop at Auto quality, at least 30 FPS on a mid-range phone, input-to-tooltip under 100 ms, no long tasks over 100 ms during interaction, INP under 200 ms. Report before/after per quality tier.

## Part E: make it clean and friendly (follow `DESIGN_SPEC.md` and `phase-2c-simple-light-ui.md`)
- **Immersive layout:** on the 3D route hide the site header and footer, use a slim top bar (Back, show title, Full screen, Settings), and add a real **Full screen button** (browser Fullscreen API; also the F key; exit with Esc), with a graceful fallback where it is unsupported (for example iPhone Safari).
- **Minimal controls:** only a three-way switch **Look around / Walk / Sit**, Full screen, Settings gear, trailer controls, and the selected-seats bar. Move FOV, presets (Default/Front/Back/Aerial), Heatmap, lights, quality, sensitivity and invert-Y into the Settings gear or a single "View" menu. Presets become a small "Camera" menu.
- **One seat card system:** a compact **hover tooltip** (seat label, price in large bold, category, status, "Click to select"), about 220 px wide, never covering the seat or leaving the viewport. **Clicking** a seat opens ONE docked details card (right side on desktop, bottom sheet on phone), maximum 340 px wide, text at least 14 px (price 22 px bold), with Select/Deselect, Sit here and a collapsed "View details". Never show a tooltip card and a docked card for different seats at the same time; hovering another seat while a card is open shows only the compact tooltip.
- **Calm seat map in 3D:** remove the orange dot markers and "x" badges. State is shown on the seat itself (see Part G); seat labels only on hover or selection; row letters small and clean at the aisle ends.
- **Default camera: "Seat picker view".** Elevated (roughly 45 to 55 degrees), from behind and above centre, framed so that all ten rows and the screen are visible with minimal overlap and every seat is easy to see and click. Provide a quick "Reset view" button. Walk mode starts at the bottom of the central aisle looking up toward the seats with the room lit and readable (not into darkness).
- **Controls hints:** a short hint bar that fades after about 10 seconds and can be reopened by a "?" button; never overlapping the selected-seats bar. The selected-seats bar sits above the bottom edge with a Clear action and one clear Continue button; it never gets covered.
- **Voice button and other floating buttons** live in one tidy cluster; nothing overlaps.
- **Honest, consistent wording** (fixes F10): replace "100% line of sight" and "100% visible" with "No obstruction found by our estimate (people in other seats are not modelled)". Make the comfort reasons match the score (a high score never shows a negative reason). Keep the "How is this calculated?" popover.
- **Text sizes everywhere in the 3D UI:** at least 14 px, hierarchy consistent; run the automated font-size scan on the 3D page in every mode.

## Part F: realistic art direction and lighting
The GLB has one vertex-colour material and no lights, so apply materials and lights at runtime without editing the original geometry (extra decorative meshes such as drapes or light strips may be added as separate objects, behind a flag). First diagnose why the room renders black (vertex-colour/colour-space handling, tone mapping, exposure, missing lights, back faces, background colour, "Lights up" not applied) and fix the cause.
1. **Three selectable looks** (`?look=a|b|c`, also in Settings), each screenshotted from the same camera poses so the owner can choose: **A: Royal Burgundy and Gold** (velvet burgundy seats with gold piping, deep carpet, warm cream walls with gold trim), **B: Warm Walnut and Cream** (walnut panelling, cream fabric panels, rust-red seats), **C: Midnight Indigo and Teal** (indigo walls, teal accents, deep blue seats with silver trim). Ship A as the default until the owner chooses. Rich and warm, not dark and not garish.
2. **Materials by node-name group:** seats (velvet or leather with soft sheen, piping/trim in a metal material), carpet (pattern or noise normal on medium/high), walls and acoustic panels (fabric with a subtle repeating rhythm), tier fronts, ceiling (matte with a coffered or coved look), sconces and LED strips (emissive), screen frame (matte black), speakers (dark metal), rails (satin brass or steel). Document in `docs/3d-materials.md`.
3. **Lighting rig:** warm house lights (about 2700–3000 K) from sconces and ceiling downlights, wall washers that create soft gradients up the side walls, an emissive ceiling cove, glowing step and aisle lights along the tiers, a gentle fill (hemisphere) light so nothing is pure black, a rim light so seats separate from the background, a cool screen spill light that follows the trailer colours, a soft projector beam and a few dust particles on medium/high, light haze, contact shadows under seats and tiers, ambient occlusion on high, restrained bloom on emissives only, filmic tone mapping and tuned exposure. At most one or two real shadow-casting lights.
4. **Two modes with a smooth animated transition:** **Lights up** (default; bright, welcoming, every seat and its state clearly readable) and **Show** (dim, cinematic, trailer glowing, aisle lights on, seat states still readable). The toggle is in Settings and the trailer control cluster.
5. **Decor that sells the realism** (optional, flagged): velvet drapes at the sides of the screen, a subtle proscenium frame and stage glow, wall art or sconce plates, a carpet runner along the aisle, exit signs.
6. **Quality tiers (Auto, Low, Medium, High)**: Low keeps good colour and lighting without costly effects.
7. **Acceptance checks (automated, from the running app):** in Lights up no more than 10 percent of a frame is near-black (luminance under a documented threshold); room regions (walls, floor, ceiling) have visible contrast with each other; the screen has less than 2 percent pure-white pixels; the seat region contrasts with the floor; screenshots at Overview, aisle, Seated A05 and J10 for the three looks and two modes; frame times per tier within the Part D targets.

## Part G: seats that look good and are easy to read
- Check which seat asset is loaded (F13). The silhouette must keep a rounded backrest, cushion and armrests at every distance; if the optimised/LOD version looks like boxes, relax the simplification or use a better LOD (detailed seats near the camera, simpler far away) and report triangle counts. If the premium seat from Phase 2c exists, use it; same footprint and eye positions as the original.
- **State on the seat itself, no markers on top:** Available (rich category colour, calm saturation), Selected (clearly distinct, bright accent with a tick above only for selected), Held by someone else (muted amber tint), Taken (desaturated grey with a subtle cross decal). Colour is never the only cue. Category colours harmonise with the chosen look and stay distinguishable at the back of the room.
- Seat spacing and lighting such that every seat in every row is visible from the default view; no overlapping or flickering (z-fighting) seats.
- Evidence: close-ups from the aisle, from behind a seat and from Seated; before/after at three distances; automated check that world bounds, eye positions and mapping are unchanged for all 100 seats.

**STOP 2.** After Parts D, E, F and G: finish the report, tag `phase-2d-done` only if every gate passes, and wait for review.

## Exit gate
Prices and categories are identical everywhere (proven by test); the trailer visibly plays on the screen for each movie; the room is lit, colourful and readable with no black void; seats are clearly visible, uncluttered and attractive; only one friendly seat card is ever shown; the 3D page is truly full screen with a Full screen button; interaction is smooth with measured numbers; every control works or is removed; wording is honest; all earlier tests still pass. List honestly anything that fell short, with numbers.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-05T13:05:01+05:30.

The user's current state is as follows:
Active Document: d:\projects\CineVerse\frontend\components\3d\CinemaWorld.tsx (LANGUAGE_UNSPECIFIED)
Cursor is on line: 1
Other open documents:
- d:\projects\CineVerse\backend\alembic\env.py (LANGUAGE_UNSPECIFIED)
- d:\projects\CineVerse\frontend\hooks\useSeatData.ts (LANGUAGE_UNSPECIFIED)
- d:\projects\CineVerse\frontend\app\page.tsx (LANGUAGE_UNSPECIFIED)
- d:\projects\CineVerse\frontend\components\MovieCard.tsx (LANGUAGE_UNSPECIFIED)
- d:\projects\CineVerse\frontend\components\Navbar.tsx (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>