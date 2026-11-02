# CineVerse 3D — Engineering Limitations & Assumptions

## 1. Unit & Distance Estimates
- **Procedural Units**: The auditorium is defined in arbitrary model units.
- **Conversion Factor**: `unit_to_meters_estimate = 0.43` is an **estimate** based on standard cinema recliner seat width ($1.28\text{ units} \approx 0.55\text{ m}$).
- **UI Transparency**: All metric measurements shown in the UI are prefixed with $\approx$ (approximate) to reflect that this is a derived model, not a physical architectural survey.

## 2. Geometric Sightlines vs. Physical Obstructions
- **Geometric Coverage**: The sightline metrics (e.g. $97.7^\circ$ horizontal FOV for row A centre, $42.0^\circ$ for row J) represent pure geometric fields of view subtended by the screen rectangle from the computed eye position.
- **No Obstruction Guarantee**: CineVerse **never** claims a view is "unobstructed". Human patron height variance (heads/shoulders), architectural safety rails, and steep rake occlusion are not dynamically modeled.
- **`ObstructionEstimator` Interface**: An architectural interface stub is defined in `lib/types.ts` with a `TODO` for prospective volumetric sightline clipping in Phase 4.

## 3. Eye Height Model
- **Seated Adult Assumption**:
  - Cushion top is estimated at $+0.80\text{ units}$ above seat minimum bounding box.
  - Seated adult eye position is placed $0.65\text{ m}$ ($1.51\text{ units}$) above cushion top.
  - Forward eye offset is positioned $0.45\text{ units}$ in front of backrest rear face.
- This represents an average seated adult ($1.75\text{ m}$ standing height). It does not dynamically account for booster seats, children, or recliner mechanism tilt.

## 4. Seat Numbering Quirk
- **Audience Point of View**: When facing the screen from the audience seating tiers, Seat `01` is on the viewer's right, and Seat `10` is on the viewer's left.
- **Integrity**: Seat IDs (`A01` through `J10`) and node names (`seat_A_01` through `seat_J_10`) remain identical to GLB nodes without silent renumbering.
- The UI displays explicit directional aids ("← Left / Right →") and notes this in the "How is this calculated?" popover.

## 5. Mock Data Boundary
- Seat statuses (`available`, `booked`, `held`) are populated deterministically by a Next.js API route handler (`GET /api/showtimes/[id]/seats`).
- The WebSocket synchronization client is provided as an interactive interface stub (`useSeatSocket`).
- In Phase 4, the route handler and hook stub will be replaced by FastAPI endpoints and real-time WebSockets with distributed Redis lock management.
- The checkout button is a clearly labeled next-phase handoff stub routing to `/checkout` with selected seat state; no fake payment transactions occur.

