# Phase 2d Report — 3D Theatre: Pricing Parity, Controls QA & Cinema Screen Trailer (STOP 1)

> **Milestone Status:** STOP 1 reached (Parts A, B, and C completed, tested, and committed). All evidence captured from the running application in `docs/evidence/phase-2d/`.

---

## 1. Summary of Findings (F1 to F14)

| Finding | Description | Reproduced | Fixed (Stop 1) | Evidence / Target Phase |
| :--- | :--- | :---: | :---: | :--- |
| **F1** | **(Critical, Money)** Prices disagree on same screen (D02 ₹250 vs ₹380, I01 ₹350 vs ₹520, C06 ₹280 Front) | **YES** | **YES** | `backend/tests/test_phase2d_part_a_pricing.py`, `frontend/tests/unit/phase2d_pricing_parity.test.ts`, `docs/evidence/phase-2d/part_b_01_seat_selected.png` |
| **F2** | Category bands differ between legend, seat label, and seed (A–B vs A–C, etc.) | **YES** | **YES** | `backend/app/schemas/showtime.py`, `frontend/public/models/seat_layout_v2.json`, `frontend/tests/unit/phase2d_pricing_parity.test.ts` |
| **F3** | Trailer does not appear on screen (flat grey slab, control bar says Pause while playing) | **YES** | **YES** | `docs/evidence/phase-2d/part_c_showtime1_overview_frame1.png`, `docs/evidence/phase-2d/part_c_showtime1_overview_frame2.png`, `frontend/e2e/phase2d_qa_and_trailer.spec.ts` |
| **F4** | Room is a black void (walls/floor/ceiling dark, "Lights up" ineffective) | **YES** | *In Progress* | Scheduled for Part F (Runtime lighting rig, 3 looks, exposure/materials) |
| **F5** | Seats are congested and blocky in Overview (overlapping flat cubes, orange dots) | **YES** | *In Progress* | Scheduled for Part G (Silhouette preservation, state styling on seats) |
| **F6** | Walk-mode seat card gigantic; Overview panels use tiny text (< 14 px) | **YES** | *In Progress* | Scheduled for Part E (Unified single seat card, minimum 14 px typography) |
| **F7** | Toolbar overload (Overview, Walk, Seated, Presets, FOV, Heatmap in one bar) | **YES** | *In Progress* | Scheduled for Part E (Minimal 3-mode switch, settings menu) |
| **F8** | Not a real full-screen experience (site header/footer visible, overlap with hints) | **YES** | *In Progress* | Scheduled for Part E (Immersive full-screen layout & browser Fullscreen API) |
| **F9** | "Tap to turn sound on" broken floating pill with word wraps mid-scene | **YES** | **YES** | Removed Drei HTML floating pill; integrated accessible sound toggle button into `TrailerControls.tsx`. Evidence: `docs/evidence/phase-2d/part_c_showtime1_overview_frame1.png` |
| **F10** | Dishonest or contradictory wording ("100% line of sight", high comfort with negative reason) | **YES** | *In Progress* | Scheduled for Part E (Honest obstruction disclosure & reason alignment) |
| **F11** | Lag and jank during interaction (pointer move re-renders, video upload stalls) | **YES** | *In Progress* | Scheduled for Part D (Scripted 60s benchmark, transient hovers, draw call batching) |
| **F12** | "Functions are not working properly" (silent control failures) | **YES** | **YES** | Part B executed complete QA matrix (B.01–B.08), fixed `toggleCompare` seat preservation bug, resolved conditional hook warnings, verified all controls |
| **F13** | Seat geometry over-simplified (curved backrest and armrest loss) | **YES** | *In Progress* | Scheduled for Part G (Detailed LOD / luxury model validation) |
| **F14** | Walk mode starts looking into dark, empty corridor | **YES** | *In Progress* | Scheduled for Part E & F (Initial camera transform & aisle light placement) |

---

## 2. Part A: Single Source of Truth for Price and Category

### Root Cause Analysis (F1 & F2)
1. **Multiple Conflicting Data Sources:**
   - The backend `SeatPricingEngine` computed prices dynamically and stored canonical category bands:
     - **Front:** Rows A–C (Base ₹280)
     - **Prime:** Rows D–G (Base ₹380)
     - **Premier:** Rows H–J (Base ₹520)
   - However, `frontend/public/models/seat_layout_v2.json` contained stale fallback values where Row C was mapped to Front (₹250), Rows D–H were Prime (₹350), and Rows I–J were Premier (₹450).
   - In `AuditoriumInfoPanel.tsx`, category rows were hardcoded to `Front: Rows A–B`, `Prime: Rows C–H`, `Premier: Rows I–J`.
   - In `SeatMap2D.tsx`, a third lookup table assigned colors based on row index.
   - When hovering D02, the hover tooltip displayed the backend price (₹380) while the layout or legend displayed stale constants (₹250 / ₹350).

### The Fix
- **Backend Schema Enhancement (`backend/app/schemas/showtime.py` & `backend/app/api/v1/showtimes.py`):**
  - Showtime responses return `tiers: List[PricingTier]` dynamically derived from the auditorium configuration.
  - Every seat item returns `{ seat_id, price, category, currency: "INR", quote_id }`.
- **Frontend Synchronization (`frontend/hooks/useSeatData.ts` & `frontend/store/useCinemaStore.ts`):**
  - Removed all hardcoded price and row-to-category tables.
  - The Zustand store ingests server `tiers` and per-seat quotes into `seatPrices`.
  - All UI surfaces (`AuditoriumInfoPanel`, `SeatMap2D`, `WalkHUD`, `SeatInformationPanel`, `SelectedSeatsBar`, `CompareView`) consume exclusively from `seatPrices` and `tiers`.
- **Static Asset Parity (`frontend/public/models/seat_layout_v2.json`):**
  - Updated fallback metadata for all 100 seats to match the canonical database seed exactly.

### Test Evidence
- **Backend Test (`backend/tests/test_phase2d_part_a_pricing.py`):**
  - `test_part_a_canonical_pricing_and_tiers`: Verifies API tiers match Front (A–C, ₹280), Prime (D–G, ₹380), Premier (H–J, ₹520), and explicitly asserts D02 (₹380, Prime), I01 (₹520, Premier), C06 (₹280, Front), D03 (₹380, Prime).
  - `test_part_a_booking_and_ticket_price_integrity`: Books seat D02 and verifies inventory matches ₹380.00 Prime.
  - *Result:* 2/2 PASSED.
- **Frontend Vitest (`frontend/tests/unit/phase2d_pricing_parity.test.ts`):**
  - 5/5 PASSED across all 100 seats verifying zero price discrepancies between tiers and layout files.

---

## 3. Part B: Functional QA Matrix & Controls Verification

An automated Playwright test suite (`frontend/e2e/phase2d_qa_and_trailer.spec.ts`) was created to execute and verify the complete 3D control matrix.

| Test ID | Control / Interaction | Expected Behavior | Automated Verification | Status | Evidence Screenshot |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **B.01** | Hover & Click Select / Deselect | Hover shows correct price quote (₹380 Prime). Click selects seat; second click deselects seat. Selected seats bar displays tally and price. | `phase2d_qa_and_trailer.spec.ts:27` | **PASS** | `docs/evidence/phase-2d/part_b_01_seat_selected.png` |
| **B.02** | Taken & Held Seat Rejection | Clicking a BOOKED (`H05`) or HELD (`B05`) seat rejects selection and displays a friendly user notification toast. | `phase2d_qa_and_trailer.spec.ts:73` | **PASS** | `docs/evidence/phase-2d/part_b_02_held_rejected_toast.png` |
| **B.03** | 8-Seat Booking Limit | Attempting to select a 9th seat (`A10` after selecting `A01-A07, A09`) rejects selection and triggers limit toast. | `phase2d_qa_and_trailer.spec.ts:99` | **PASS** | `docs/evidence/phase-2d/part_b_03_eight_seat_limit.png` |
| **B.04** | Sit Down & Seated Navigation | Sit down at seat transitions camera to exact eye height (`seat_y + 0.65m`) facing screen. Next/prev seat and row controls work. | `phase2d_qa_and_trailer.spec.ts:125` | **PASS** | `docs/evidence/phase-2d/part_b_04_seated_pov_c05.png` |
| **B.05** | View Modes & Camera Presets | Switching between Overview, Walk Mode, and Seated POV correctly updates camera transforms, FOV presets (55°, 70°, 85°), and toggles Heatmap overlay. | `phase2d_qa_and_trailer.spec.ts:176` | **PASS** | `docs/evidence/phase-2d/part_b_05_heatmap_active.png` |
| **B.06** | Walk Mode Row Jump | Clicking row jump buttons (e.g. "Row J") teleports the player directly to the designated row aisle coordinate. | `phase2d_qa_and_trailer.spec.ts:247` | **PASS** | `docs/evidence/phase-2d/part_b_06_walk_teleport_row_j.png` |
| **B.07** | Compare View Modal | Compare button opens comparison modal displaying perspective cards and specifications for selected seats (`D02`, `H05`). | `phase2d_qa_and_trailer.spec.ts:270` | **PASS** | `docs/evidence/phase-2d/part_b_07_compare_view_modal.png` |
| **B.08** | 2D ↔ 3D Selection Sync | Selecting seat in 3D reflects immediately in 2D seat map and persists through checkout initiation. | `phase2d_qa_and_trailer.spec.ts:295` | **PASS** | `docs/evidence/phase-2d/part_b_08_selection_sync_2d_3d.png` |

---

## 4. Part C: Cinema Screen Trailer Verification

### Root Cause Analysis (F3 & F9)
1. **Backface Culling & Plane Normal:** The dynamic Three.js screen plane geometry was initialized with standard orientation facing `+Z`. In the auditorium coordinate system, the screen is at `-Z` and the audience looks toward `-Z`. Consequently, the plane normal faced away from viewers and was backface-culled.
2. **GLB Screen Mesh Occlusion:** The imported GLB model contained a static mesh named `cinema_screen_surface` positioned at `z = -1.250`. The video overlay plane positioned at `z = -1.250` was occluded and suffered from extreme z-fighting.
3. **Texture Invalidation under Demand Rendering:** Three.js VideoTexture requires continuous frame updates (`videoTexture.needsUpdate = true`) and R3F demand loop invalidations (`invalidate()`) during playback. Without continuous invalidation, paused render loops froze the texture on a single grey buffer.
4. **Broken Sound Pill (F9):** A Drei `<Html>` element with absolute pixel constraints was floating mid-screen, wrapping words awkwardly.

### The Fix
1. **Geometry Correction (`frontend/components/3d/Screen.tsx`):**
   - Created a custom screen plane rotated 180° on the Y axis (`geom.rotateY(Math.PI)`), pointing its normal directly toward the audience.
   - Inverted horizontal UV coordinates (`uvs.setX(i, 1 - uvs.getX(i))`) to preserve correct left-to-right orientation.
   - Positioned plane at `[0, 5.55, -1.255]` with `DoubleSide` rendering and negative polygon offset.
2. **GLB Mesh Occlusion Fix (`frontend/components/3d/AuditoriumModel.tsx`):**
   - Set `cinema_screen_surface.visible = false` at model load time, eliminating z-fighting and geometry clashes.
3. **DOM Attachment & Autoplay Pipeline:**
   - Appended the `<video>` element to `document.body` (hidden) to prevent headless browser autoplay throttling and garbage collection.
   - Added `invalidate()` inside `useFrame` during active playback to drive continuous video texture refreshes.
4. **Integrated Sound Controls (`frontend/components/3d/TrailerControls.tsx`):**
   - Removed the broken floating Drei HTML pill (F9).
   - Added a docked, accessible Sound button (`data-testid="trailer-mute-toggle"`) with clear "Tap for Sound" / "Sound On" states in the trailer HUD.

### Test Evidence & Multi-Movie Verification

#### Automated Playwright Verification (`e2e/phase2d_qa_and_trailer.spec.ts`)
- **Advancing Timestamps (C.01):**
  - Showtime 1 (`Quantum Odyssey`):
    - T0 Current Time: `13.097s` (Video Width: 1920, Height: 1080)
    - T+2s Current Time: `15.321s` (Timestamp advanced by `2.224s`)
- **Canvas Pixel Audit (C.01):**
  - Rendered video frames to an offscreen 2D canvas: **1,664 non-zero pixels** out of 2,304 sampled (proving non-blank, active video content).
- **Multi-Movie Verification (C.02):**
  - **Showtime 1:** `quantum_odyssey.webm` (`/trailers/quantum_odyssey.webm`)
  - **Showtime 2:** `astra.webm` (`/trailers/astra.webm`)
  - **Showtime 3:** `shadow_protocol.ogv` (`/trailers/shadow_protocol.ogv`)

#### Photographic Evidence (`docs/evidence/phase-2d/`)
1. **Overview Perspectives (2 seconds apart):**
   - `part_c_showtime1_overview_frame1.png` vs `part_c_showtime1_overview_frame2.png` (Showtime 1 - Quantum Odyssey)
   - `part_c_showtime2_astra_overview.png` (Showtime 2 - Astra)
   - `part_c_showtime3_shadow_overview.png` (Showtime 3 - Shadow Protocol)
2. **Auditorium Camera Positions:**
   - **Walk Mode (Row E):** `part_c_03_walk_row_e_frame1.png` and `part_c_03_walk_row_e_frame2.png`
   - **Seated POV (A05 Front Row Center):** `part_c_03_seated_a05_frame1.png` and `part_c_03_seated_a05_frame2.png`
   - **Seated POV (J10 Premier Back Row Corner):** `part_c_03_seated_j10_frame1.png` and `part_c_03_seated_j10_frame2.png`
   - **Mobile Viewport (360x640):** `part_c_03_mobile_360x640_overview.png`

---

## 5. Git Commit Log for Milestone STOP 1

- `58732f7`: `feat(phase-2d): Part A - canonical pricing and category parity across backend and frontend`
- `e73bebe`: `feat(phase-2d): Part B - full functional QA table and controls verification`
- `54b39bf`: `feat(phase-2d): Part C - cinema screen trailer resolution, proper plane orientation, and sound controls`

---

## 6. Stop Point Review

As mandated by `phase2d_prompt.txt`:
> **STOP 1.** After Parts A, B and C: commit, write the first half of the report with evidence and wait for review.

All three parts (A, B, C) are fully implemented, verified via automated test suites (73 backend pytest, 8 frontend Vitest, 11 Playwright E2E), and committed to git. Awaiting user review before beginning Parts D, E, F, and G.
