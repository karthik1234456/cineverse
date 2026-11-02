# CineVerse 3D — Immersive 3D Auditorium Experience

> **"Experience the theatre before booking your movie."**

CineVerse 3D is a photorealistic, performant WebGL 3D auditorium seat selection and POV sightline exploration application built using **Next.js (App Router)**, **TypeScript**, **React Three Fiber (Three.js)**, **Zustand**, **TanStack Query**, and **Tailwind CSS**.

---

## Quick Start

### 1. Requirements
- **Node.js**: v18.0.0+ (Tested and verified on Node.js `v24.11.1`, npm `11.6.2`)
- **Python**: 3.9+ (for procedural seat metadata generation tool)
- **Modern Browser**: Chrome, Edge, Safari, Firefox with WebGL support

### 2. Installation & Running Dev Server

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000/3d](http://localhost:3000/3d) in your browser.
Production routes:
- `/3d` — Direct auditorium viewport with interactive controls
- `/cinemas/cineverse-central/auditorium/auditorium-1?showtime=101` — Production route

### 3. Build & Type Checking

```bash
cd frontend
npm run build    # Compiles Next.js production build cleanly
npm run lint     # Validates ESLint rules with 0 warnings
npx tsc --noEmit # Validates TypeScript types
```

### 4. Running Tests

#### Unit Tests (Vitest)
Validates mathematical calculations, screen FOV, distance, horizontal/vertical angles, GLB node mappings, and bounding box assertions:

```bash
cd frontend
npm run test
```

#### End-to-End Tests (Playwright with SwiftShader)
Tests orbit boundary clamping, F05 seat selection, booked/held seat rejections, live hold updates, seat POV transitions (A05, E05, J10), keyboard navigation, multi-seat comparison, house lights modes, mobile responsiveness, and WebGL fallbacks:

```bash
cd frontend
npx playwright test
```

---

## Project Structure

```
├── docs/
│   ├── 3d-architecture.md          # Coordinate conventions, GLB mapping, camera state machine
│   ├── 3d-performance.md           # Before/after triangle counts, file sizes, framerates
│   ├── 3d-limitations.md           # Geometric estimates, obstruction disclaimers, seat numbering
│   └── screenshots/                # 9 verified E2E screenshots
├── frontend/
│   ├── app/
│   │   ├── 3d/                     # Bare dev route
│   │   ├── cinemas/[cinemaId]/...  # Dynamic production cinema route
│   │   ├── api/showtimes/...       # Deterministic seat status mock API
│   │   └── checkout/               # Phase 4 next-phase stub
│   ├── components/3d/
│   │   ├── AuditoriumExperience.tsx# Main full-screen 3D container
│   │   ├── CinemaWorld.tsx         # R3F Canvas, WebGL config, DevBridge
│   │   ├── AuditoriumModel.tsx     # GLB loader, seat mesh management, POV active seat hiding
│   │   ├── SeatInteraction.tsx     # 12-tri invisible proxy boxes for raycasting & state shells
│   │   ├── CameraController.tsx    # Clamped OrbitControls & interruptible Bezier POV slerp
│   │   ├── Screen.tsx              # Cinematic dynamic screen canvas with film bloom & projector cone
│   │   ├── TheatreLighting.tsx     # Sconce/ceiling lights, screen bounce & house lights modes
│   │   ├── WayfindingLabels.tsx    # Aisle row badges A-J
│   │   ├── AuditoriumInfoPanel.tsx # Left panel (format, pricing, status counts, honesty popover)
│   │   ├── SeatInformationPanel.tsx# Right panel (angles, distance, FOV, coverage bar, actions)
│   │   ├── SelectedSeatsBar.tsx    # Bottom bar (selected chips, total price, checkout stub)
│   │   ├── ViewModeToggle.tsx      # Top floating bar (presets, POV navigation, FOV lens toggle)
│   │   ├── CompareView.tsx         # Side-by-side comparison modal for up to 3 seats
│   │   └── MobileControls.tsx      # Responsive bottom sheet (peek/half/full) for mobile (≤768px)
│   ├── lib/
│   │   ├── types.ts                # TypeScript definitions & ObstructionEstimator interface
│   │   ├── seatView.ts             # Pure math: distance, angles, FOV, coverage
│   │   └── assertCoordinates.ts    # Startup Box3 verification vs JSON bounds
│   ├── public/models/
│   │   ├── cineverse_auditorium_v2.glb     # Original high-detail model (9.56 MB, 1.52M tris)
│   │   ├── cineverse_auditorium_v2.web.glb # Optimized model (1.06 MB, 218k tris)
│   │   └── seat_layout_v2.json             # 100 seat records generated from GLB
│   └── store/
│       └── useCinemaStore.ts       # Zustand centralized 3D state
└── tools/
    └── generate_seat_layout.py     # Procedural seat layout JSON generator
```
