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
- **Seat Numbering Quirk**:
  - Seat `A01` is situated at $X \approx -6.0$, which is on the **audience's right** when seated facing the screen.
  - The UI and wayfinding labels explicitly preserve this official venue coordinate convention without silent renumbering, rendering "← Left / Right →" directional indicators.

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
The original GLB shares a single vertex-colored PBR material (`CineVerse_Vertex_Color_PBR`). Mutating this material globally would alter all seats simultaneously; cloning 100 unique 15k-triangle materials would balloon draw calls and GPU memory overhead.

CineVerse implements **Approach (b): Lightweight State Shells & Emissive Bounds**:
- A fitted bounding shell and wireframe highlight overlay each seat based on its state.
- **Available**: Category-tinted soft glow ring (Front: `#c9a227`, Prime: `#4f8cff`, Premier: `#b04fff`).
- **Booked**: Desaturated dark grey veil (`#18181b`, opacity 0.55), disabled cursor, non-interactive.
- **Held**: Pulsing warm amber (`#f59e0b`, animated $\sin(t)$ opacity pulse).
- **Selected**: Cinematic red (`#e50914`, opacity 0.42) with bright outline (`#ff4d5a`) and floating 3D badge.
- **Hover**: Brightened category rim with floating cursor tooltip.
- **POV Occlusion Management**: When a user enters POV for a seat, that seat's own GLB mesh node is hidden (`node.visible = false`) to prevent clipping into the camera eye lens, while all seats in front remain 100% visible to provide realistic depth, headrest rake, and sightline perspective.

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


