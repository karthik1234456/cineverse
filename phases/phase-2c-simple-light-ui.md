# Phase 2c — Simple, friendly, light and colourful UI; bigger text; better seats; the right trailer on the 3D screen

> **Session preamble:** You are building CineVerse. First read `phases/COMMON_RULES.md` (mandatory rules for every phase), `DESIGN_SPEC.md` (updated: it now defines a LIGHT, rich-colour theme and larger type), `ANTIGRAVITY_PROMPT.md`, `SECURITY_SPEC.md`, `docs/PROJECT_STATUS.md` and the latest reports. Do ONLY this task. Run every existing suite first (backend, Vitest, `tsc --noEmit`, Playwright) and keep them green. Never mark anything done without evidence in `docs/evidence/phase-2c/`. Diagnose root causes; do not hide problems. Finish with `docs/PHASE_2C_REPORT.md` (PASS / FAIL / NOT DONE) and STOP for review.
>
> **Order:** if `phase-2b-visual-overhaul.md` has not been run yet, run its **Part A (verification) and Part B (remove boxes, seat states)** first. This phase **replaces the colour palette and HUD layout parts (2b Parts C and D)** where they conflict: the product is now light, colourful and simple, not dark and busy.

## Why (feedback from the product owner, in plain words)
1. The website text is **too small**.
2. Use a **light, rich, colourful** look instead of near-black backgrounds.
3. **Seats look poor**; improve their quality.
4. The **trailer of the particular movie** must play on the screen in the 3D theatre.
5. **Hover over a seat shows its price** (instantly, big enough to read).
6. **Remove the yellow selection box**.
7. Make the website **simpler and more user-friendly**, not complex.

## Part 1 — Typography: bigger, clearer (applies to every page)
- Body text **18 px** (1.125 rem) with line-height 1.6; **no visible text smaller than 14 px anywhere** (captions, badges, chart labels, tooltips, 3D HUD included). Buttons and form inputs 18 px, button height at least 48 px, touch targets at least 48×48 px with 8 px spacing. Headings: H1 40–48 px, H2 30–34, H3 22–24. Prices and seat numbers in the HUD at least 18 px, bold.
- Fonts self-hosted: a friendly, highly legible sans (for example Inter or Plus Jakarta Sans); optional display face for hero titles only. Support browser zoom to 200% and OS text scaling without breaking layouts (use rem units, no fixed-height text boxes).
- Muted text must still pass contrast 4.5:1 on its background. No grey-on-grey microcopy.
- **Automated test:** a Playwright scan of every route at 1366×768 and 390×844 that computes the font size of every visible text node and fails if any is under 14 px, and if body text is under 17 px. Include the 3D page overlays. Save the report.

## Part 2 — Light, rich colour theme
Update the Tailwind tokens and every component to the new palette in `DESIGN_SPEC.md` (warm ivory page background, white cards, tinted sections, and **rich colour bands**: deep burgundy-to-magenta and indigo-to-violet gradients for heroes, banners and step headers; crimson primary buttons; gold and teal accents). Rich does not mean garish: generous white space, one strong colour per screen area, consistent rounded cards, soft shadows.
- Provide light theme only as default (no dark default). A dark mode may exist later; do not build it now.
- Posters sit on white or softly tinted cards; hero sections use full-width colour gradients with the movie backdrop blended in and large white text (contrast checked).
- All states (hover, focus, disabled, error, success) redefined for the light theme with visible focus rings.
- **Automated test:** axe contrast checks on all key pages with zero serious or critical violations; screenshot set at 360, 768 and 1280 widths.

## Part 3 — Make it simple (this is the main design goal)
Apply a **simplicity budget** and remove anything that does not help someone book a ticket:
- **Navigation:** only `Movies`, `Cinemas`, `My Tickets`, plus city selector, search icon and Sign in. Move everything else (offers, help, language, voice, settings) into one profile/menu button or the footer. No more than 6 items visible in the header on desktop, 4 icons in the mobile bottom bar.
- **Home:** one hero (movie of the day with two buttons: Book tickets, Watch trailer), then three rows at most (Now showing, Coming soon, Offers). Remove duplicate sections and clutter. One search box.
- **Booking in 3 big, clearly numbered steps** shown at the top: **1 Choose show → 2 Choose seats → 3 Pay**. Each screen has **one primary button** (large, colourful), a plain-language title and at most one short helper line. Add-ons and coupons are optional, collapsed by default ("Add snacks", "Have a coupon?"), never blocking.
- **Seat page:** big 2D seat map by default, simple legend (Available, Yours, Taken), price shown per category band, a summary bar at the bottom with seats, total and a big **Continue** button. The **"See it in 3D"** button is clear and friendly but secondary. Hide technical details (angles, FOV, coverage) behind a small "Seat view details" link; show only a plain sentence by default, such as "Good centre view, about 9 m from the screen (estimate)".
- **3D page:** a clean full-screen view with only: back button, simple mode switch (Look around / Walk / Sit), a hint line for controls, the hover price tooltip, the selected-seats bar with total and Continue, a play/pause/mute control for the trailer, and one settings gear (quality, lights, sensitivity, FOV all live inside it). **Hide by default:** FPS counters, dev tools, geometric coverage bars, seat numbers on every seat, and large side panels (open them from one "Details" button).
- **Plain language everywhere:** short sentences, no jargon ("screen field of view" becomes "how much of your view the screen fills"), consistent Indian English, ₹ amounts with thousands separators, times in 12-hour format with AM/PM.
- **Reduce clicks:** from the home page a person must reach seat selection in **at most 4 clicks** (movie → showtime → seat count → seats) and see the price before paying. Remember the last city and language. Pre-select 2 tickets. Offer a **Quick book** shortcut on the seat page: "Pick the best seats for me" for N people (uses the best-seat logic if available; otherwise a simple middle-rows, together-in-a-row rule) which the user can still change.
- **Helpful errors and states:** friendly sentences with one clear action ("Those seats were just taken. Here are the nearest free ones."), progress indicators, and a visible hold timer with a calm tone.
- **Accessibility and comfort:** works with keyboard only, screen readers, reduced motion, no auto-playing sound, no motion-heavy hero.
- **Automated tests:** (a) a "first-time user" Playwright script that books 2 seats from the home page and counts clicks and screens (budget: max 4 clicks to seats, max 3 steps to pay); (b) a test that every page has exactly one primary button and no more than the allowed header items; (c) a check that no developer UI is visible without `?debug=1`.

## Part 4 — 3D seat interaction: hover price, no yellow box, clear selection
- **Hovering the pointer over a seat** shows a compact tooltip within 100 ms near the cursor: seat label (for example `E06`), **price in ₹ (large, bold)**, category name, status (Available / Taken / Held / Yours) and a short hint ("Click to select"). On touch devices a first tap shows the same tooltip and a clear **Select** button; a second tap selects. Keyboard: focusing a seat (arrow keys in the seat list or mouse) shows the same info. The tooltip must never cover the seat itself and must stay inside the viewport.
- **Remove every yellow, blue or red selection box** (and any translucent box around seats, including proxies and "state shells"). Interaction proxies are invisible. Selected seats are shown on the real seat: strong crimson seat colour plus a small tick/number badge above the seat; hovered seats get a soft outline glow; taken seats are greyed with a small cross; held seats show a gentle amber pulse. Colour plus a symbol, never colour alone.
- Add a Playwright assertion via `window.__cineverse` that no visible proxy or helper objects exist, that the tooltip appears with the correct price (from the server data, not a client guess) for at least five different seats across the three categories, that it disappears when the pointer leaves, and a screenshot with several selected seats showing no boxes.

## Part 5 — Better-looking seats
First improve what exists, then upgrade the model only if that is not enough.
1. **Shading and materials (runtime, no geometry change):** correct vertex-colour handling and colour space, smooth normals where the mesh has hard edges by mistake, a fabric/velvet material (rough, soft sheen), a slightly glossy trim for armrests and base, visible stitching or panel lines via a subtle procedural normal map on medium/high tiers, ambient occlusion contact shadows under seats, per-category colours that look rich but harmonious (for example deep ruby for Premier, royal blue for Prime, warm amber-brown for Front) while keeping selected = crimson clearly distinguishable. Seats must look good from the back of the room, from the aisle and when seated in front of another row.
2. **If still not good enough, add an optional premium seat asset:** author a better single seat (for example 3k–6k triangles: rounded bevelled backrest and cushion, side armrests with a cup-holder detail, footrest edge, believable proportions) as `frontend/public/models/seat_premium.glb`, facing **+Z** with the same footprint as the original seat bounds so collisions, walk mode and seat POV eye positions do not change. Place it by instancing at each seat's node position (visually replacing the heavy original seat mesh while keeping `node_name` ↔ `seat_id` mapping, proxies and layout data identical). Provide the flag `?seats=original` to compare. Keep the original GLB untouched. Document how the seat asset was produced (script or tool) in `docs/3d-seats.md`.
3. **Performance bonus:** the replacement should cut the scene's triangle count versus the original 15k-triangle seats; report before/after triangle counts and frame times.
4. **Evidence:** before/after close-ups from the aisle, from behind a seat, from Seated A05 and J10, and the overview, in Lights-up mode on the three quality tiers. Automated test that the new seat's world bounds stay within 1 cm of the original bounds for all 100 seats and that the eye position and screen visibility are unchanged.

## Part 6 — The right trailer on the 3D screen
Implement or repair this exactly as `ANTIGRAVITY_PROMPT.md` section 5c and `DESIGN_SPEC.md` section 5 describe, with these product rules:
- The 3D theatre opened for a showtime plays **the trailer of that showtime's movie**, resolved server-side from showtime → movie → trailer asset. Never fall back to a different movie's trailer. If the movie has no playable trailer file, the screen shows that movie's poster/backdrop with a friendly line ("Trailer not available") and the normal trailer button opens the standard player if an embed exists.
- Muted autoplay starts when the screen is in view; one large, obvious **"Tap to turn sound on"** button; play/pause and mute controls always visible and large; the trailer pauses when the user leaves the 3D page or the tab is hidden and resumes when they return. Only one video element plays at a time across the site.
- Seed at least three different movies each with a **different, locally hosted, licensed trailer** so correct mapping can be tested. If no rights-cleared trailers are available, use clearly licensed open content (for example Creative Commons open movies by the Blender Foundation) with attribution recorded in the media table and shown on the movie page; confirm each licence before including it. Never download or embed trailers from services whose terms forbid it.
- Fit and framing: letterboxed inside the screen without stretching, black bars where needed, correct colour (no washed-out or over-bright video), light spill onto the audience from the video colours on medium/high tiers.
- **Tests (Playwright):** open the 3D theatre for showtimes of three different movies and assert that the video source differs and matches the movie (by media id exposed through `window.__cineverse`), the video time advances, frames differ across two screenshots, the screen has no clipped pure-white area, the trailer keeps playing in Walk and Seated modes, pauses on tab hide, and the fallback poster shows for a movie without a trailer. Include mobile viewport and the CORS-failure fallback.

## Part 7 — Cleanup and consistency
- Delete leftover dark-theme-only styles, unused components and unused routes that make the site feel complex. List removed items in the report.
- Update Storybook (or the component gallery) screenshots to the new theme.
- Update `docs/design-system.md` with tokens, type scale, spacing and the simplicity budget so future phases keep it simple.
- Keep all earlier behaviour: security rules, booking engine, 2D↔3D shared selection, seat numbering (seat 01 on the audience's left), honesty wording for estimates ("approximate", never "unobstructed").

## Evidence required
Before/after screenshots (home, movie page, showtimes, seat map, 3D theatre overview, 3D hover tooltip, 3D walking, seated view, checkout, ticket) at desktop 1366×768 and 1920×1080 and phone portrait; font-size report (zero text under 14 px); axe report; click-count report; seat close-ups; trailer-mapping test results; frame time table per quality tier; a short list of what was removed to simplify.

## Exit gate
Text is clearly readable everywhere; the site is light and richly coloured; the booking journey is short and obvious; hovering a seat shows its price instantly; no yellow or other boxes appear; seats look noticeably better; each movie's own trailer plays on the 3D screen; all earlier tests still pass. Report honestly anything that fell short, with numbers.
