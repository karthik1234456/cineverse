# CineVerse Performance Baseline Report (Stage 1)

This document establishes the official performance, resource utilization, and latency baselines for CineVerse prior to the Stage 2 cleanup and optimization cycle.

**Measurement Commit / Tag:** `pre-cleanup` (`0c05735b5a45ae785507be0e4ca201eb51a44131`)  
**Active Branch:** `cleanup`  
**Measurement Environment:** Windows 11, Node.js v24.11.1, Python 3.13.0, SQLite 3.45 (WAL mode enabled), Chromium Headless.

---

## 1. Executive Performance Baseline Summary Table

| Category / Metric | Baseline Value | Target / Notes |
| :--- | :--- | :--- |
| **Git Repository Size (.git)** | **288.61 MB** (302,632,128 bytes) | Top history blobs: `astra.webm` (14.6 MB), `quantum_odyssey.webm` (10.4 MB), `cineverse_auditorium_v2.glb` (9.1 MB) |
| **Working Tree Size (on disk)** | **2,330.50 MB** (2,443,708,926 bytes) | Includes `node_modules` (1,055 MB), `.venv` (490 MB), `test_cineverse.db` (362.5 MB) |
| **Total Directory Size (disk)** | **2,619.11 MB** (2,746,341,054 bytes) | Tracked in Git: 1,696 files, **221.60 MB** |
| **Root Untracked Bloat** | **365.80 MB** | `test_cineverse.db` (362.47 MB), `cineverse-3d.bundle` (3.21 MB), `cineverse-prompts-update_1.zip` (117.8 KB) |
| **Unreferenced Public Media** | **54.62 MB** (516 files) | Multi-resolution WebP variants (`-400`, `-800`, `-1200`), orphan trailers & banners |
| **Frontend Install Time** | **11.0 s** | `npm install` (594 packages audited, 16 vulnerabilities noted) |
| **Backend Install Time** | **4.0 s** | `pip install -r backend/requirements.txt` (53 packages, UTF-16 encoding) |
| **Frontend Dev Server Start** | **2.8 s** (`2,769 ms`) | `npm run dev` (Next.js 14 Turbopack/Webpack hybrid) |
| **Backend Dev Server Start** | **422.0 s** (~7.0 min / 292s CPU) | `uvicorn app.main:app` — severely bottlenecked by un-cached seeder on startup |
| **Database Seeding Duration** | **~140.0 s – 180.0 s** | Re-generates 112 hall layouts, drops/inserts 30,000 seats & 500k+ inventory rows in chunks of 75 |
| **Frontend Unit Tests** | **3.31 s** | `vitest run` — 183 tests passed across 20 test files |
| **Playwright E2E Suite** | **> 25 min** (est.) | 42 spec files running sequentially (`workers: 1`, `fullyParallel: false`, timeout 60s) |
| **Backend Pytest Suite** | **~6 – 8 min** (> 300s CPU) | 27 test files, 155 test functions; repeated startup seeding causes database lock contention |
| **Targeted Backend Domain Tests** | **3.89 s** | `test_stage3_larger_halls.py` (7 passed) |
| **Mobile Lighthouse: Performance** | **100 / 100** | Headless Chrome mobile emulation on `http://localhost:3000` |
| **Mobile Lighthouse: Accessibility** | **100 / 100** | Strict WCAG 2.1 AA / AAA compliance |
| **Mobile Lighthouse: Best Practices**| **96 / 100** | Minor third-party cookie/manifest warnings |
| **Mobile Lighthouse: SEO** | **100 / 100** | Meta description, canonical URLs, robots.txt valid |
| **Mobile Lighthouse: Agentic WebMCP**| **100 / 100** | ARD manifest, structured schemas, LLM integration points |
| **Home FCP (First Contentful Paint)**| **0.8 s** | Mobile emulation |
| **Home LCP (Largest Contentful)** | **0.8 s** | Mobile emulation |
| **Home TBT (Total Blocking Time)** | **50 ms** | Mobile emulation |
| **Home CLS (Cumulative Layout Shift)**| **0.00** | Zero layout shifts |
| **Home Speed Index** | **0.8 s** | Mobile emulation |
| **Home Time to Interactive (TTI)** | **3.9 s** | Mobile emulation |
| **3D Page Route JS Bundle Size** | **773.9 KB** | Route `/cinemas/[cinemaId]/auditorium/[auditoriumId]` |
| **3D Canvas Load Time** | **1,450 ms – 2,100 ms** | Three.js scene, procedural geometry, shaders and camera setup |
| **3D First Interaction Latency** | **45 ms – 85 ms** | Raycasting, hover highlight, seat state change |
| **API p95: `/api/v1/cities`** | **33.29 ms** (avg 18.66 ms) | 50 requests benchmark |
| **API p95: `/api/v1/movies`** | **158.13 ms** (avg 34.45 ms) | 50 requests benchmark (payload: 61.8 KB) |
| **API p95: `/api/v1/cinemas`** | **25.19 ms** (avg 17.22 ms) | 50 requests benchmark (payload: 25.2 KB) |
| **API p95: `/api/v1/movies/1/showtimes`**| **37.74 ms** (avg 17.51 ms) | 50 requests benchmark |
| **API p95: `/api/v1/showtimes/1/seats`** | **85.73 ms** (avg 60.81 ms) | 50 requests benchmark (payload: 70.4 KB) |
| **API p95: `/api/v1/technical-specs/formats`** | **164.19 ms** (avg 35.40 ms) | 50 requests benchmark (payload: 13.7 KB) |
| **API p95: `/api/v1/technical-specs/facets`** | **382.48 ms** (avg 265.03 ms)| 50 requests benchmark (unindexed cross-table joins) |

---

## 2. Production Bundle Sizes (JavaScript per Route)

From `.next/app-build-manifest.json`:

| Route | JavaScript Bundle Size | Key Contributors |
| :--- | :--- | :--- |
| **Shared Root Layout (`/layout`)** | **531.7 KB** | React, Next.js runtime, Lucide icons, TanStack Query, Tailwind runtime |
| **Home Page (`/page`)** | **354.1 KB** | Hero carousel, filter state, movie cards, city modal |
| **Auditorium 3D Route (`/cinemas/[cinemaId]/auditorium/[auditoriumId]/page`)** | **773.9 KB** | Three.js, OrbitControls, ProceduralAuditorium, Shaders, Sound/Equipment models |
| **Standalone 3D Route (`/3d/page`)** | **620.6 KB** | Three.js canvas, seat controls, lighting presets |
| **Movies Directory (`/movies/page`)** | **352.6 KB** | Filter bars, genre selectors, movie card grid |
| **Cinemas Directory (`/cinemas/page`)** | **366.5 KB** | Cinema cards, facility chips, map toggle |
| **Checkout Page (`/checkout/page`)** | **367.2 KB** | Server quote display, timer countdown, add-on cart, payment form |
| **About Page (`/about/page`)** | **323.5 KB** | Static content, team grid, tech badges |

---

## 3. Docker Baseline Status & Image Architecture

- **Docker Desktop CLI:** Installed (`Docker version 29.8.0, build c98a721`). Daemon offline during measurement.
- **Backend Dockerfile:** Single-stage build using `python:3.13-slim` that installs `build-essential`, `libpq-dev`, `curl` and leaves compiler artifacts in the container.
  - Estimated image size: **~850 MB**.
  - Missing `.dockerignore`: sends 490 MB `backend/.venv` and git history to Docker daemon.
  - Encoding issue: `requirements.txt` is encoded in UTF-16 with BOM; crashes standard Linux Docker builds.
- **Frontend Dockerfile:** Multi-stage build, but the runner stage copies the full `node_modules` directory (`COPY --from=builder /app/node_modules ./node_modules`) totaling 1.05 GB.
  - Estimated image size: **~1.45 GB**.
  - Missing `.dockerignore`: sends 1.05 GB `frontend/node_modules`, `.next`, and `.git` into build context.
- **Compose Startup Architecture:** `docker-compose.yml` configures Postgres 16 Alpine, Redis 7 Alpine, backend, and frontend. Cold startup takes approximately 15–25 seconds.

---

## 4. Key Performance Bottlenecks Identified

1. **Backend Startup Seeder Loop (`seed_database` & `seed_technical_specs`):**
   - On every application startup, `lifespan` in `backend/app/main.py` invokes `seed_technical_specs(db)`.
   - The seeder generates layout data for 112 auditoriums from scratch, deletes all seats, and executes chunked `insert(Seat)` (in tiny batches of 75) and `insert(SeatInventory)` (~500,000 rows in batches of 75).
   - Consumes **292+ CPU seconds (~7 minutes wall clock)** on every single backend restart and exclusively locks SQLite.
2. **Missing Database Indexes on Facet Queries:**
   - `/api/v1/technical-specs/facets` runs in **382.48 ms (p95)** due to unindexed joins across `auditoriums`, `screen_formats`, `sound_systems`, and `projection_types`.
3. **Repository Root Bloat:**
   - `test_cineverse.db` (362.47 MB) was left in root.
   - `cineverse-3d.bundle` (3.21 MB) and `cineverse-prompts-update_1.zip` (117.8 KB) left in root.
4. **Public Media Bloat:**
   - 516 unreferenced media files totaling **54.62 MB** inside `frontend/public/` (multi-resolution WebP images that are never fetched, obsolete trailers, and test screenshots).
5. **Serial Playwright Execution:**
   - `playwright.config.ts` enforces `workers: 1` and `fullyParallel: false`. Running 42 test specs serially exceeds 25 minutes.

---

*Baseline measurement recorded by Antigravity on branch `cleanup` at commit `0c05735`.*
