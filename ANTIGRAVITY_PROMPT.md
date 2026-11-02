# CineVerse 3D — Phase 3 build prompt (3D Auditorium Experience only)

You are a senior 3D graphics engineer and frontend architect. Build the **immersive 3D auditorium experience** for CineVerse 3D using the supplied GLB. Work in this repo; actually write, run and test code. Do NOT build payments, auth, admin, or the full backend in this phase. Do not claim a feature works until you have run it and have evidence (screenshots / assertion output).

Tagline: "Experience the theatre before booking your movie."

---

## 0. Repo contents you must use (already verified by analysis — re-verify in code)

```
frontend/public/models/cineverse_auditorium_v2.glb   (9.5 MB, glTF binary)
frontend/public/models/seat_layout_v2.json           (100 seats, GENERATED from the GLB by tools/generate_seat_layout.py)
tools/generate_seat_layout.py
```

### Verified facts about the GLB
- 262 nodes, 261 meshes, **1 material** (`CineVerse_Vertex_Color_PBR`, metal 0.04, rough 0.78, doubleSided), **vertex colours only** (`COLOR_0`), no textures, no lights, no cameras.
- **~1.52 million triangles. 1.516M of them are the 100 seats** (each seat = 15,164 tris, all 100 geometrically identical). Everything else is tiny. This is the main performance problem (see §6).
- Seats ARE individual named mesh nodes: `seat_A_01` … `seat_J_10` (rows A–J = 10 rows, 01–10 = 10 per row). Map by node name. No proxies are needed for naming, but **use invisible box proxies for raycasting** (never raycast 15k-tri meshes).
- Other useful nodes: `room_floor, front_wall, back_wall, left_wall, right_wall, ceiling, acoustic_panel_{L,R}_NN, panel_trim_*, screen_outer_frame, cinema_screen_surface, screen_stage_lip, tier_platform_A..J, central_aisle_tread_*, aisle_edge_light_{L,R}_*, wall_led_*, wall_sconce_*, ceiling_light_*, speaker_tower_*, speaker_driver_*, rail_post_*`.

### COORDINATE TRAP (do not skip)
Raw vertex data is Blender Z-up, but **every mesh node carries a matrix** (Rx +90°) that converts it to glTF Y-up. After three.js loads it, world space is **glTF Y-up**:
- Screen centre ≈ `(0, 5.55, -1.255)`; screen 15.6 wide × 7.25 high (aspect 2.15).
- The audience sits at **more negative Z** (row A eye z≈-8.07 … row J eye z≈-21.57). **Seats face +Z.**
- Therefore a camera at a seat must `lookAt(screenCenter)` — the default camera forward (-Z) points AWAY from the screen. Facing +Z, the viewer's right is **-X**.
- Interior ≈ x[-11,11], y[0,11.06], z[-25.7,-0.3].
- Seat numbering quirk: `A01` is at x=-6, i.e. on the audience's RIGHT when facing the screen. Keep IDs as-is; in the UI draw row labels and mark "← Left / Right →" from the audience's point of view, and mention this in docs. Do not silently renumber.
- **Never trust my numbers blindly**: at startup, load the GLB, compute each seat node's world-space Box3 with `Box3.setFromObject`, and assert it matches `seat_layout_v2.json` `bounds_gltf_y_up` within 0.01. Fail loudly in dev if not. Also assert screen centre.

### seat_layout_v2.json
Per seat: `seat_id` (e.g. `A01`), `node_name`, `row`, `number`, `category` (front/prime/premier), `price`, `position_gltf_y_up`, `bounds_gltf_y_up`, `eye_position_gltf_y_up`, `screen_distance`, `screen_distance_m_est`, `horizontal_offset_deg` (+ = screen centre to viewer's right), `vertical_angle_deg` (+ = looking up), `screen_h_fov_deg`, `screen_v_fov_deg`. Also `units`, `eye_model`, `categories`.

**Honesty rules (must appear in the UI as a small "How is this calculated?" popover):**
- Units are model units; `unit_to_meters_estimate = 0.43` is an ESTIMATE from seat width. Show metres as "≈".
- Eye position is a geometric estimate for a seated adult (cushion top + 0.65 m, 0.45u in front of backrest). It is NOT a measurement of a physical cinema.
- No obstruction (heads, rails, rake occlusion) is modelled. NEVER say a view is "unobstructed". Label visibility as "Geometric screen coverage". Add an `ObstructionEstimator` interface stub + TODO only.
- Expected sanity values (use as unit-test fixtures): row A centre seat h-FOV ≈ 97.7°, row E ≈ 62.6°, row J ≈ 42.0°; distances A05 ≈ 7.5u, J05 ≈ 20.4u.

---

## 1. Stack (frontend only this phase)
Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, React Three Fiber, three, @react-three/drei, @react-three/postprocessing (optional, gated), Framer Motion (UI only), Zustand (3D state), TanStack Query (seat-status fetching). Pin versions; run `npm run build` and `tsc --noEmit` clean.

Route: `/cinemas/[cinemaId]/auditorium/[auditoriumId]?showtime=ID` (also a bare `/3d` dev route). Full-viewport canvas (`100dvh`), UI overlays on top. The canvas must occupy the whole screen — panels are translucent overlays, not cards around a small canvas.

## 2. Seat data (no payments, but no hardcoding in components)
Create `services/seatStatusService.ts` + `GET /api/showtimes/[id]/seats` as a **Next.js route handler mock** returning `{seatId, status: available|booked|held}` from a deterministic seeded generator (e.g. ~28% booked, ~4% held). Mark it clearly `// MOCK – replaced by FastAPI later`; same response shape the FastAPI endpoint will use. Components read status only through TanStack Query + the Zustand store. Add a dev-only "simulate another user holds seat X" button to prove live colour updates; a `useSeatSocket` hook stub with the interface for the later WebSocket. "Selected" is client state; selecting a booked/held seat must be rejected with a toast. Max 8 seats.

## 3. Component architecture (`frontend/components/3d/`)
`CinemaWorld` (Canvas, renderer config, Suspense) · `AuditoriumModel` (GLB load, node→seat mapping, material handling, does NOT mutate original geometry) · `SeatInteraction` (invisible proxy boxes from seat bounds + raycast/hover/click/touch) · `SeatMesh`/`SeatStateVisuals` (state colouring) · `SeatCamera`/`CameraController` (modes + transitions) · `SeatPOV` · `Screen` (screen content overlay) · `TheatreLighting` · `LoadingOverlay` · `ErrorBoundary` + WebGL-unsupported fallback · UI: `AuditoriumInfoPanel` (left), `SeatInformationPanel` (right), `SelectedSeatsBar` (bottom), `ViewModeToggle`, `MobileControls`, `Minimap`. Pure TS in `lib/seatView.ts`: `screenDistance`, `horizontalAngle`, `verticalAngle`, `screenFov`, `cameraTarget`, `eyePosition`, `geometricCoverage` — unit-tested with Vitest using the fixtures above. No god-component.

## 4. Seat colours / states (clear, colour-blind-safe — also vary by icon/outline, not hue only)
| State | Look |
|---|---|
| Available | category-tinted soft green/neutral glow (legend shows category colour ring) |
| Booked | dark grey, desaturated, no hover |
| Held (by someone else) | amber, subtle pulse |
| Selected | cinematic red `#e50914` + emissive + floating seat label |
| Hover | brighten + outline + label tooltip (desktop); tap = select-preview on touch |

The GLB uses ONE shared vertex-colour material, so do NOT mutate it. Choose and document one approach: (a) clone a material per seat and tint via `color` (multiplies vertex colours) + `emissive`, or (b) overlay a thin, slightly larger, transparent "state shell" (reuse the proxy box or a simplified seat silhouette) with the state colour. Prefer whichever keeps draw calls and GPU cost lowest on mobile; prove the choice with numbers. Original geometry stays intact; one-line reset restores the original look.

## 5. Camera & navigation (the heart of the product)

**Auditorium mode (orbit):** OrbitControls with damping, `minDistance/maxDistance`, polar-angle limits, and a **bounding box clamp so the camera never leaves/clips through walls, floor or ceiling**. Default framing: elevated 3/4 view from the back-right looking at the screen so seats and screen are both visible. Smooth wheel/pinch zoom, right-drag/two-finger pan (clamped), double-click/double-tap a seat = open its POV, double-click empty = reset view. Preset buttons: Overview · Front rows · Back rows · Aerial (top-down seat map in the real 3D scene — not a flat 2D diagram).

**Seat POV mode:** Camera placed at `eye_position_gltf_y_up`, `lookAt(screen centre)`. `near` ≈ 0.05, FOV default 60° with a toggle (50/60/75) — document that FOV here is the camera lens, separate from the screen-subtended angle shown in the panel. Limited look-around (drag/gyro): yaw ±60°, pitch ±25° around the screen direction, damped, with a "recentre" button. Hide the selected seat's own mesh in POV (or hide only when it blocks the lens). Don't hide other seats — they provide realistic depth/occlusion of rows ahead.

**Transitions (must be smooth and never clip through geometry):** interpolate position with an eased curve and orientation with **quaternion slerp** (never lerp lookAt targets/Euler angles). When going orbit↔POV or seat↔seat, route through a short Bezier path that rises above the seat rows (e.g. y ≥ 7) to avoid passing through seats/walls. 0.9–1.3 s, interruptible (new request mid-flight retargets from the current pose). Respect `prefers-reduced-motion` (cut instead of fly). FOV animates with the position. Prev/Next seat in POV moves along row; Up/Down changes row; keyboard: ←/→ prev/next, ↑/↓ row, Esc back, C compare, Enter select.

**Compare (basic in this phase):** pick up to 3 seats; side-by-side small R3F views use `View` (drei) on ONE canvas (do NOT create multiple WebGL contexts) — or a quick-switch strip if performance doesn't allow. Show distance, h/v angle, screen FOV, category, price per seat; highlight best/worst per metric with neutral wording.

## 6. Performance (mandatory; measure and report before/after)
The seats alone are 1.5M triangles. Required:
1. **Measure first**: render stats (`renderer.info`: calls, triangles), FPS on desktop and with CPU/GPU throttling, load time, memory. Put numbers in `docs/3d-performance.md`.
2. **Keep the original GLB untouched.** Create an optimised variant `cineverse_auditorium_v2.web.glb` using `@gltf-transform/cli` (`weld`, `simplify` with a conservative error on SEATS ONLY, `meshopt` or Draco compression, `prune`, `dedup`). Target: ≤ 2.5k tris/seat (~250k total scene), ≤ 3 MB. Compare screenshots of original vs optimised seats; if the silhouette degrades visibly in POV (seats directly in front of the camera are visible in POV!), use a LOD: high-detail only for seats within N units of the camera (drei `Detailed`/manual LOD) and low-detail elsewhere. Report exactly what you did. Serve the optimised file by default; query flag `?hq=1` loads the original.
3. If all 100 seats share identical geometry after optimisation, consider `InstancedMesh` ONLY if per-seat state colouring and picking stay correct (use `instanceColor`); otherwise keep nodes. Decide with data.
4. Frustum culling on; `frameloop="demand"` while idle, invalidate on interaction/transition; DPR clamp `[1, 1.5]` on mobile; shadows: at most one baked-feel directional + contact shadows (no per-light real-time shadow maps for the many small lights); no more than ~2 real shadow-casting lights; selective post-processing (bloom on emissive only; skip SSAO on mobile). Auto-quality tier via `PerformanceMonitor`.
5. Lazy-load the 3D route (`next/dynamic`, `ssr:false`), `useGLTF.preload`, progress bar via `useProgress`, graceful failure with retry + "WebGL not supported" fallback.

## 7. Realism enhancements (you may add these; the original geometry stays intact)
The GLB has no lights, no textures and a single material, so it looks flat unless lit well. Add at runtime:
- **Lighting rig** (`TheatreLighting`): very low ambient/hemisphere; HDRI-free `Environment` via `Lightformer`s for soft reflections; a subtle screen-colour light spill (rect area/spot) from the screen onto the audience; warm point lights at the `wall_sconce_*` and `ceiling_light_*` node positions with intensity from a "house lights" slider (Full → Dim → Show). Use the existing emissive-looking nodes (`aisle_edge_light_*`, `wall_led_*`) as light sources — place small emissive tint + bloom.
- **House-lights modes:** "Lights up" (default for exploring/booking: readable) and "Show mode" (dimmed, screen glowing, aisle LEDs lit) with a smooth animated transition. Seat state colours must stay legible in both.
- **Screen content:** keep `cinema_screen_surface`; overlay a `Screen` plane 0.005u in front, aspect 2.15, with a local movie backdrop texture (local placeholder image/looping canvas-generated gradient; no external URLs) and `toneMapped=false` emissive glow. Letterbox correctly. Optional: a subtle volumetric projector cone from the back wall (cheap additive cone, low opacity) and faint dust particles (instanced points, ≤ 300; disable on low tier).
- **Atmosphere & materials:** subtle fog (matches room colour), ACES/AgX tone mapping, slight exposure control, contact shadows under tiers/seats, fake AO via baked-looking vertex tint (do not edit the GLB). A very subtle reflection/gloss on the floor (roughness map or `MeshReflectorMaterial` only on high tier). Carpet/fabric feel via a procedural normal-ish noise (high tier only). Floor/ceiling stay original meshes.
- **Row/seat wayfinding in 3D:** floating row letters (drei `Text`/`Billboard`) at the aisle edges, small seat-number decals on hover/selection only (not 100 permanent labels), a subtle floor-level path highlight to aisles.
- **Audio-free** (no sound this phase).
- Everything here must be toggleable by a quality tier and must not tank mobile FPS. Document each enhancement and its cost.

## 8. UI (premium, cinematic, responsive)
Dark charcoal/black surfaces, deep-red accent, restrained animation, premium typography (e.g. Inter + a display face), spacious. Avoid generic dashboard look.
- **Desktop:** left panel (auditorium info, screen format, category legend with price, colour legend with counts: available/booked/held/selected) · full-bleed canvas centre · right panel (selected seat: ID, row/number, category, price, distance ≈ m + units, horizontal offset L/R, vertical angle, screen FOV, geometric coverage bar, "Preview seat view", "Select seat", "Compare") · bottom bar (selected chips with remove, total price, Continue button that is a clearly-labelled disabled-next-phase stub which routes to `/checkout` placeholder with the selection in state — no fake payment).
- **Mobile (≤ 768px):** no side panels. Bottom sheet (snap points peek/half/full) for the seat info and selected seats; top compact bar; floating view-mode toggle, recentre, house-lights, quality menu. Large touch targets (≥ 44px), pinch/drag/two-finger pan, tap-to-preview, long-press/double-tap for POV, safe-area insets, no hover-only interactions, no page scroll bleed (`touch-action: none` on canvas), landscape works.
- Keyboard accessible controls with ARIA labels; focus rings; reduced-motion support; tooltips explain angles.
- Loading overlay with progress %, stage text, and a graceful error screen.

## 9. Testing — REQUIRED, with evidence
1. **Unit (Vitest):** `lib/seatView.ts` against the fixtures; mapping test that all 100 `node_name`s exist in the GLB and each `seat_id` is unique; coordinate-assertion test (world Box3 vs JSON).
2. **E2E (Playwright, Chromium with SwiftShader: `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`)**. Expose a dev-only `window.__cineverse` (camera pose, mode, selected seats, hovered seat, renderer.info) so tests assert state, not just pixels. Cover and screenshot (save to `docs/screenshots/`):
   - Model loads, progress hits 100%, FPS/tri stats logged, no console errors.
   - Orbit rotate / wheel zoom / pan: camera pose changes and stays inside the clamp box (try to drag it outside).
   - Hover + click on seat F05 (via projected screen coordinates of its proxy): selected state, colour changes, side panel shows correct values from JSON.
   - Booked/held seat click is rejected; simulated hold updates colour live.
   - Seat POV for A05, E05, J10 — assert camera position == eye_position within 0.001 AFTER the transition, camera forward dot (screenCenter − eye) normalised > 0.99, screen visible (projected screen centre inside the viewport), screenshot of each.
   - Mid-transition interruption, prev/next/row navigation at row/seat edges (no wrap bugs, no out-of-range), Esc returns to the previous orbit pose.
   - Compare 2 and 3 seats.
   - Mobile viewport (390×844) with touch emulation: bottom sheet, pinch (CDP touch events), tap select, double-tap POV, rotate to landscape.
   - Quality tier switch, house-lights modes, WebGL-fail fallback (block WebGL context creation).
3. Run `npm run build`, `tsc --noEmit`, `eslint`. Fix every failure — diagnose, don't bypass.

## 10. Deliverables & final report
- Working app: `cd frontend && npm install && npm run dev` (document exact commands, Node version, env).
- `docs/3d-architecture.md` (coordinate conventions, mapping, camera state machine, state colouring decision), `docs/3d-performance.md` (before/after numbers), `docs/3d-limitations.md` (estimates, no obstruction, mock data, seat numbering orientation, units).
- Final report: a table of every priority below with PASS/FAIL, the evidence file path, and an explicit list of anything NOT working. Do not mark done what you didn't test.

Priorities, in order: (1) full-screen 3D auditorium, (2) smooth rotation/zoom/navigation, (3) clickable individual seats, (4) state colours available/booked/selected/held, (5) accurate GLB↔JSON↔seat-ID mapping, (6) realistic seat POV, (7) smooth transitions, (8) info panel with angles & distance, (9) responsive desktop + mobile.

## Rules
Don't replace or regenerate the supplied model with box geometry. Don't flatten into a 2D seat map. No nonfunctional buttons (stub features must be visibly labelled and disabled with a reason). No secrets in frontend. No external network assets at runtime (local fonts/textures). If something is ambiguous, make a reasonable engineering decision and document it in the docs rather than stopping.
