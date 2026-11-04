# CineVerse 3D — Architecture & Technical Specifications

## 1. Coordinate Conventions & Space Mapping

### Source Geometry vs glTF Y-Up Space
The supplied procedural auditorium asset was authored with Blender-style coordinates ($+Z$ up, $+Y$ depth). However, every mesh node in the glTF binary (`cineverse_auditorium_v2.glb`) carries an internal rotation matrix ($R_x(+90^\circ)$), which Three.js and `@react-three/fiber` evaluate into standard **glTF Y-up right-handed coordinate space**:
- **Screen Center**: `(0.000, 5.550, -1.255)`
- **Screen Dimensions**: $15.6\text{ m wide} \times 7.25\text{ m high}$ (Aspect ratio $\approx 2.152$)
- **Audience Seating Axis**: Audience rows are positioned along negative $Z$:
  - Row A: $Z \approx -8.07$
  - Row E: $Z \approx -13.62$
  - Row J: $Z \approx -21.57$
- **Facing Direction**: Because the audience sits at negative $Z$ and the screen is at $Z \approx -1.255$, **all seats face $+Z$ toward the screen**.
- **Viewer Point of View**:
  - In a right-handed system facing $+Z$:
    - $+Y$ is **Up**
    - $-X$ is the **Viewer's Right**
    - $+X$ is the **Viewer's Left**
- **Seat Numbering & Spatial Orientation**:
  - In glTF right-handed Y-up space facing $+Z$ (the screen), $+X$ points to the **Audience's Left** and $-X$ points to the **Audience's Right**.
  - In `cineverse_auditorium_v2.glb`, node `seat_A_10` is at $X \approx +6.0$ (audience-left) and `seat_A_01` is at $X \approx -6.0$ (audience-right).
  - Standard cinema convention dictates that Seat 01 begins on the audience's left when facing the screen.
  - Phase 2b corrected this mapping by establishing:
    $$\text{seat\_num} = 11 - \text{node\_num}$$
    Hence node `seat_A_10` is seat `A01` (audience-left), and node `seat_A_01` is seat `A10` (audience-right).
  - Both 3D wayfinding badges and the 2D SVG seat map match this convention with Seat 01 on the left.

### Coordinate Verification & Startup Assertions
At startup and in unit tests (`lib/glbIntegrity.test.ts`), the system iterates through all 100 seat meshes, calculates each node's world-space `Box3` via `Box3.setFromObject(node)`, and asserts that `box.min` and `box.max` strictly match `seat_layout_v2.json`'s `bounds_gltf_y_up` within a $0.01\text{ unit}$ threshold.

---

## 2. GLB to JSON to Seat ID Mapping Architecture

Each seat is mapped directly by its glTF node name (`seat_A_01` through `seat_J_10`):
- **Rows**: 10 rows (`A` through `J`)
- **Seats per Row**: 10 seats (`01` through `10`)
- **Total Seats**: Exactly 100 seats
- **Raycasting Proxy Boxes**:
  - Raw seat meshes contain 15,164 triangles each ($1.516\text{M}$ total triangles).
  - Raycasting high-polygon meshes degrades frame rates on pointer move.
  - CineVerse utilizes **invisible proxy boxes** constructed dynamically from each seat's `bounds_gltf_y_up` (12 triangles per proxy, 1,200 triangles total).
  - Raycasting hits the 12-triangle proxy box instantly, eliminating CPU raymarching bottlenecks.

---

## 3. State Colouring & Visual Design

### Color Decision & GPU Efficiency
The original GLB shares a single vertex-colored PBR material (`CineVerse_Vertex_Color_PBR`).

In Phase 2b, the engine upgraded from early prototype overlay boxes to **Real Mesh Materials & Invisible Interaction Proxies**:
1. **Per-Seat Cloned Materials**:
   - `AuditoriumModel.tsx` clones `MeshStandardMaterial` for each of the 100 seat meshes.
   - States are applied directly to the real seat geometry rather than drawing external bounding cubes:
     - **Available**: Deep crimson theatre velvet (`#78141b`, roughness 0.72) with category-subtle emissive tint.
     - **Hover**: Polished silver highlight (`#ffffff`, roughness 0.35, metalness 0.2, emissive `#ffffff` 0.15).
     - **Selected**: Vibrant cinematic red (`#c81e28`, roughness 0.45, emissive `#ff2233` 0.95) with a floating `✓` badge.
     - **Held**: Pulsing warm amber (`#b45309`, roughness 0.50, animated emissive `#f59e0b` 0.85) with a pulsing `●` badge.
     - **Booked**: Darkened matte slate (`#202227`, roughness 0.90, emissive `#000000`) with a subtle `✕` badge. Non-interactive.
2. **Invisible Interaction Proxies**:
   - To retain fast raycasting against 12-triangle bounding boxes rather than 15k-triangle meshes, the engine retains proxy boxes in `SeatInteraction.tsx`.
   - Proxies are rendered with `opacity={0}`, `depthWrite={false}`, and `colorWrite={debugProxies}`.
   - Exactly **0 proxy pixels** are rasterized in normal and production builds (`window.__cineverse.getVisibleProxiesCount() === 0`).
   - Completely eliminates translucent box visual clutter and near-camera clipping artifacts (such as the bottom-left red triangle).
   - A `?debug=proxies` query parameter allows developers to visualize raycast hulls during development.

---

## 4. Camera State Machine & Interpolation Architecture

```
                      ┌───────────────────────────────────────┐
                      │             OVERVIEW MODE             │
                      │  • OrbitControls (clamped bounding)   │
                      │  • Presets: Default, Front, Back,     │
                      │    Aerial top-down 3D seat map        │
                      └──────────▲─────────────────▲──────────┘
                                 │                 │
                'O' / Click      │                 │  'O' / Esc
                                 │                 │
                                 ▼                 ▼
             ┌─────────────────────────┐     ┌─────────────────────────┐
             │        WALK MODE        │     │       SEATED MODE       │
             │ • First-person game FPS │◄───►│ • Eye position exact    │
             │ • W/A/S/D + Shift run   │ Esc │   seat.eye_position     │
             │ • Sub-stepped collision │  /F │ • Damped look ±80°/±35° │
             │ • Ground tier following │     │ • Q/E & Z/X seat step   │
             │ • Aim crosshair + [E]   │ Sit │ • Trailer plays on 3D   │
             │ • Virtual touch joystick│  [E]│   screen directly ahead │
             └─────────────────────────┘     └─────────────────────────┘
```

### Transition Mechanics
1. **Interruptibility**: Transitions can be interrupted mid-flight; any new target pose immediately takes the camera's current instantaneous position and orientation as its origin.
2. **Bezier Obstacle Clearance**: Camera routes through a 3D Bezier curve whose apex is elevated ($Y \ge \max(y_{\text{start}}, y_{\text{end}}, 7.2\text{u}) + 0.6\text{u}$). This guarantees the camera arcs over intermediate seat rows and handrails rather than penetrating geometry.
3. **Quaternion Slerp**: Orientations are strictly interpolated using spherical linear interpolation (`quaternion.slerpQuaternions`). Euler angle lerping is forbidden to avoid gimbal flip and camera spin artifacts.
4. **Reduced Motion**: If the user has `prefers-reduced-motion` enabled, the camera cuts instantly to the target pose.

---

## 5. Walk Mode Collision & Physics Architecture (`WalkCollision`)

First-person walk mode operates using pure-TypeScript, frame-rate independent physics derived directly from `walk_nav_v2.json`:
- **Collision Volumes**: 21 walkable surface AABBs (auditorium floor, 10 tier platforms $A\dots J$, 10 central aisle treads) and 122 colliders (perimeter walls, screen frame, stage lip, speaker towers, 14 handrail posts, and 100 solid seat bounding boxes).
- **Player Capsule**: Cylinder/capsule of radius $0.30\text{u}$ with standing eye height $3.77\text{u}$.
- **Horizontal Sliding**: Circle-vs-AABB intersection calculations push the player smoothly along collider faces, eliminating corner stickiness.
- **Sub-stepping Anti-tunneling**: High delta time or running speed ($6.0\text{u/s}$) is subdivided into sub-steps of maximum $0.05\text{u}$, ensuring thin barriers (e.g., stage lip or rail posts) cannot be penetrated.
- **Ground Following & Step Clamps**: Maximum step-up is strictly clamped at $0.30\text{u}$ (accommodating the $0.22\text{u}$ tier and tread steps), while step-down is clamped at $0.40\text{u}$ to act as an edge-guard, preventing accidental drops off high platforms. Eye height transitions over tiers are critically damped for natural stair traversal.
- **Controls & Interaction**: Desktop WASD / arrow keys and pointer-lock mouse look; mobile dual-touch virtual joystick and touch drag. Aiming the crosshair at any seat within $4.2\text{u}$ triggers instant contextual inspection and an $[E]$ prompt to sit down.

---

## 6. Lighting, Screen Tonemapping & Visual Hierarchy

### Screen Tonemapping & Contrast
- In earlier builds, the virtual cinema screen had `toneMapped={false}` with high brightness multiplier ($1.5$), which bypassed Three.js ACES Filmic tonemapper and clamped values to $(255, 255, 255)$, resulting in blown-out, detail-deprived visuals.
- Phase 2b enabled `toneMapped={true}` and clamped video luminance ($\le 1.0$) with calibrated screen emissive intensity ($0.95$).
- Pixel analysis of `03_seated_a05.png` confirms **0.008% clipped pure-white pixels**, preserving screen contrast and dynamic range without flattening.

### Lighting Rig
1. **Hemisphere Gradient**:
   - Sky color `#38455e` (cool slate blue) and ground color `#181a20` (warm charcoal) provide natural ambient fill across non-shadowed areas.
2. **Key Stage/Auditorium Light**:
   - Directional light positioned high above the rear-center casting soft shadows down onto tiers and aisles. Limited to $\le 2$ shadow casters globally to preserve 60 FPS on low-power devices.
3. **Architectural Wall Sconces & Step Lights**:
   - Sconces at $x = \pm 10.2$ cast warm downward accents (`#ffbe76`, $3000\text{K}$).
   - Low-intensity amber strip lights along aisle steps illuminate walkways without causing glare.
4. **Atmospheric Fog**:
   - Soft exponential height fog (`#07080a`, near 15, far 60) deepens theatre scale and prevents background clipping.

---

## 7. HUD & First-Person UX Architecture

### Minimal First-Person HUD
- When entering **Walk Mode** or **Seated POV Mode**, the left navigation/legend panel (`AuditoriumInfoPanel`) and right seat detail panel (`SeatInformationPanel`) automatically hide.
- In first-person modes, the viewport presents a clean cinematic canvas containing:
  - Subtle central reticle / crosshair.
  - Contextual interaction aim tooltip when targeting a seat.
  - Floating mode toggle (`Overview / Walk / Seated`) positioned at `top-20` (80px), preserving a 16px gutter below the 64px fixed site header.
  - Selected seats checkout summary bar anchored at the bottom.
- When returning to **Overview Mode**, the informational panels smoothly re-appear.

### Responsive Positioning & Safe Areas
- Header offset: `top-20` prevents overlap with the top navigation bar.
- Internal scrolling: Panels use `max-h-[calc(100dvh-6rem)] overflow-y-auto` so content never bleeds past screen edges.
- Mobile controls: Floating voice AI and joystick controls are offset to `bottom-20 right-4` to avoid colliding with the checkout bar.
- Production hygiene: Dev tools and debug toggles are strictly hidden in production builds and only rendered when `?debug=1` is provided in dev mode.

---

## 8. Known Limitations & Technical Trade-offs

1. **Software WebGL Performance in Headless CI**:
   - Headless Playwright runs on Windows without GPU hardware acceleration use SwiftShader (software rasterizer). Full 1080p frame renders take 10–15 seconds each. Production testing requires generous timeouts (180s–240s) or dedicated GPU runners.
2. **Single-GLB Material Partitioning**:
   - The venue asset `cineverse_auditorium_v2.glb` was exported with a single combined material. CineVerse dynamically traverses the scene graph at load time to assign distinct PBR parameters to 162 non-seat nodes and 100 cloned seat materials. This incurs a ~25ms startup CPU cost during model mounting, which is negligible compared to network transfer time.
3. **Headless Human Occlusion**:
   - The seat view angles and sightlines are geometric ray estimates from eye position to screen edges. Simulated heads and shoulders of patrons seated in front rows are not rendered in 3D geometry; disclaimers clarify this to booking patrons.



