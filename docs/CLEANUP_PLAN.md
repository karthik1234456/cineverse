# CineVerse Cleanup & Optimization Plan (Stage 1)

**Commit / Baseline Tag:** `pre-cleanup` (`0c05735b5a45ae785507be0e4ca201eb51a44131`)  
**Target Branch:** `cleanup`  
**Status:** **AWAITING USER APPROVAL (Change Nothing in Codebase until Approved)**

---

## 1. Overview & Strategy

This plan specifies every candidate file, dependency, asset, and code pattern identified for removal or optimization during Stage 2. All candidates are backed by concrete static analysis, disk usage audits, and execution profiling.

No destructive changes or code modifications will occur until this plan is formally reviewed and approved by the user.

---

## 2. Removal Candidates (Detailed Specifications)

### A. Unused npm Dependencies (`frontend/package.json`)

| Package | Version | Disk Size | Evidence / Reason Unused | Risk | What Would Break if Wrong |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `express` | `^4.21.2` | ~2.1 MB | 0 imports in codebase. Frontend uses Next.js App Router API routes; no standalone Express server. | **Low** | Nothing. Zero references in `frontend/` or `backend/`. |
| `cors` | `^2.8.5` | ~40 KB | 0 imports in codebase. Unused Express middleware. Next.js handles CORS via route headers or middleware. | **Low** | Nothing. |
| `axios` | `^1.7.9` | ~1.4 MB | 0 imports in codebase. Frontend data fetching exclusively uses standard browser `fetch` and TanStack React Query. | **Low** | Nothing. |
| `clsx` | `^2.1.1` | ~15 KB | 0 imports in codebase. Class strings are composed via standard template literals. | **Low** | Nothing. |
| `tailwind-merge` | `^2.6.0` | ~350 KB | 0 imports in codebase. Utility function `cn()` does not exist; Tailwind classes are not merged dynamically. | **Low** | Nothing. |
| `framer-motion` | `^11.18.2` | ~6.8 MB | 0 imports in codebase. UI transitions use Tailwind CSS classes; 3D transitions use Three.js lerp/spring arms. | **Low** | Nothing. |
| `meshoptimizer` | `^0.21.0` | ~2.2 MB | 0 imports in codebase. Procedural auditorium geometry is generated at runtime; GLTF models do not use EXT_meshopt_compression. | **Low** | Nothing. |
| `ffmpeg-static` | `^5.2.0` | ~45.0 MB | 0 imports in codebase. Heavy FFmpeg binary packaged inside node_modules but never invoked by frontend. | **Low** | Nothing. |
| `@types/three` | `^0.170.0` | ~1.1 MB | Currently under `"dependencies"`. Belongs strictly in `"devDependencies"`. | **Low** | Nothing; purely TypeScript type definitions. |

**Net Frontend Dependency Savings:** ~59.0 MB on disk, cleaner dependency tree, faster `npm install`.

---

### B. Unused Python Dependencies (`backend/requirements.txt`)

| Package | Evidence / Reason Unused | Risk | What Would Break if Wrong |
| :--- | :--- | :--- | :--- |
| `opentelemetry-api` | 0 imports across `backend/`. No distributed tracing telemetry active in current architecture. | **Low** | Nothing. Zero references in python files. |
| `reportlab` | 0 imports across `backend/`. Tickets and receipts are rendered as HTML/JSON; PDF generation is not called. | **Low** | Nothing. |
| `razorpay` | 0 imports across `backend/`. Payment gateway integration uses custom HMAC SHA256 webhook signatures and mock testing. | **Low** | Nothing. |
| `requests` | 0 imports across `backend/`. HTTP client calls use asynchronous `httpx` or standard `urllib`. | **Low** | Nothing. |
| `asyncpg` | 0 imports in active app. SQLite with `aiosqlite` is used as primary database. | **Low** | Only if deployed against external PostgreSQL without installing asyncpg. (Can move to extras or remove). |
| `requirements.txt` Encoding | File is encoded in UTF-16 with BOM. Standard Linux/Docker `pip install` crashes with `UnicodeDecodeError`. | **Low** | Fixes Docker Linux build without changing dependency resolution. |

---

### C. Dead & Obsolete Code (Drone Mode Remnants)

The user previously instructed the removal of the drone camera mode in Stage 1/2. Residual references remain across 11 files:

| File Path | Nature of Remnant | Proposed Action | Risk | What Would Break if Wrong |
| :--- | :--- | :--- | :--- | :--- |
| `frontend/components/3d/ViewModeToggle.tsx` | Button and SVG icon for drone mode | Remove unused `'drone'` case and button | **Low** | Users could not click a defunct drone button. |
| `frontend/components/3d/HearItFromHereModal.tsx`| String reference to drone mode | Remove reference | **Low** | None. |
| `frontend/lib/types.ts` | `ViewMode = 'orbit' \| 'fpv' \| 'screen' \| 'drone'` | Remove `'drone'` from union type | **Low** | Compiler catches any residual invalid assignments. |
| `frontend/e2e/catalogue_glimpse_drone.spec.ts` | E2E test verifying drone navigation | Clean up drone test assertions | **Low** | Obsolete test that tests non-existent UI. |

---

### D. Stray Root Files & Untracked Bloat

| File Path | Size | Evidence / Reason | Risk | What Would Break if Wrong |
| :--- | :--- | :--- | :--- | :--- |
| `test_cineverse.db` | **362.47 MB** | Temporary SQLite database created during manual test runs. Bloats workspace. | **Low** | Nothing. Automated tests use isolated temporary or in-memory databases. |
| `cineverse-3d.bundle` | **3.21 MB** | Standalone Git bundle archive created during earlier work session. | **Low** | Nothing. All commits exist in repository history. |
| `cineverse-prompts-update_1.zip`| **117.8 KB** | Temporary prompt archive zip file. | **Low** | Nothing. |

**Net Root File Savings:** **~365.8 MB**.

---

### E. Unused Public Media Assets (`frontend/public/`)

Static analysis identified 516 unreferenced media files totaling **54.62 MB** inside `frontend/public/`:

| Asset Group / Path | Size | Evidence / Reason | Risk | What Would Break if Wrong |
| :--- | :--- | :--- | :--- | :--- |
| `frontend/public/posters/*-400.webp`, `*-800.webp`, `*-1200.webp` (384 files) | **~28.4 MB** | Multi-resolution responsive variants. Code and database only ever query canonical `/posters/{slug}.jpg` or `.webp`. | **Low** | Nothing. Next.js image optimization or direct image tags load base poster. |
| `frontend/public/banners/midnight_comedy_banner.png` | **3.52 MB** | 0 references in code, seed data, or database. | **Low** | Nothing. |
| `frontend/public/banners/monsoon_banner.png` | **4.01 MB** | 0 references in code, seed data, or database. | **Low** | Nothing. |
| `frontend/public/banners/chakravyuh_banner.png` | **2.84 MB** | 0 references in code, seed data, or database. | **Low** | Nothing. |
| `frontend/public/banners/inferno_banner.png` | **3.02 MB** | 0 references in code, seed data, or database. | **Low** | Nothing. |
| `frontend/public/banners/interstellar_chronicles_banner.png` | **2.51 MB** | 0 references in code, seed data, or database. | **Low** | Nothing. |
| `frontend/public/trailers/shadow_protocol.webm` | **14.86 MB** | Movie `shadow_protocol` was replaced or not in active catalogue; trailer is not referenced in DB. | **Medium** | If trailer is queried dynamically, video would not play. (Preserved if any doubt; verified against DB). |
| `frontend/public/report_screenshot_*.png` (12 files) | **~4.2 MB** | Temporary bug report evidence screenshots stored in public folder. | **Low** | Nothing. |

**Net Media Savings:** **~54.6 MB**.

---

### F. Docker & Build Optimization

| Area | Current State | Proposed Optimization | Risk | What Would Break if Wrong |
| :--- | :--- | :--- | :--- | :--- |
| `.dockerignore` | Missing in root, `frontend/`, and `backend/`. Context sends > 1.8 GB to daemon. | Add `.dockerignore` ignoring `node_modules`, `.venv`, `.next`, `.git`, `*.db*`. | **Low** | None. Dramatic speedup in build context transfer. |
| `backend/Dockerfile` | Single-stage, installs build tools (`build-essential`), final image ~850 MB. | Convert to multi-stage build; copy only installed virtualenv to runner (~220 MB). | **Low** | Ensure all shared libraries (`libpq`, etc.) are linked if postgres is used. |
| `frontend/Dockerfile` | Copies full 1.05 GB `node_modules` into runner container (~1.45 GB). | Configure `output: 'standalone'` in Next.js; copy only minimal standalone server (~120 MB). | **Medium** | Must verify Next.js standalone server starts properly with 3D routes. |

---

### G. Backend Startup Seeder Optimization (Critical Developer Velocity Win)

| File | Current Issue | Optimization | Risk | What Would Break if Wrong |
| :--- | :--- | :--- | :--- | :--- |
| `backend/app/main.py`<br>`backend/app/seed/seeder.py`<br>`backend/app/seed/seed_tech_specs.py` | Startup lifespan runs `seed_technical_specs` on every server launch, regenerating 112 halls and chunk-inserting 30,000 seats & 500,000 inventory rows (taking **422 seconds / 292s CPU**). | Add idempotency check: if `ScreenFormat` count >= 17 and auditoriums are already assigned and seats exist, skip layout re-generation and seat re-insertion. Run full seed only with `--force` or when tables are empty. | **Low** | Fast server start (< 2s). Full re-seed remains accessible via `python -m app.seed.seeder --force`. |

---

### H. Database Index Optimization for Sub-300ms p95 Target

| Table | Index Target | Purpose | Baseline p95 | Target p95 |
| :--- | :--- | :--- | :--- | :--- |
| `auditoriums` | `(screen_format_id, sound_system_id, projection_type_id)` | Accelerate `/api/v1/technical-specs/facets` joins | **382.48 ms** | **< 50.0 ms** |
| `showtimes` | `(auditorium_id, format)` | Accelerate showtime format filtering | **37.74 ms** | **< 15.0 ms** |
| `movies` | `(is_showcase, is_tmdb, id)` | Accelerate `/api/v1/movies` catalog listing | **158.13 ms** | **< 30.0 ms** |

---

### I. Fully Merged Git Branches

The following local git branches have been verified as fully merged into `main` and current HEAD:
- `phase-6-maps` (verified merged)
- `phase-movie-backdrop` (verified merged)

**Proposed Action:** Delete stale local tracking branches `git branch -d phase-6-maps phase-movie-backdrop`. (Risk: Zero).

---

### J. Git History Blobs (Report Only — No History Rewrite)

As strictly required by the prompt guidelines, **git history will NOT be rewritten or modified**. The following large blobs are documented for situational awareness:

| Object SHA | Approximate Size | File Reference in History |
| :--- | :--- | :--- |
| `3805f63` | **14.58 MB** | `frontend/public/trailers/astra.webm` |
| `c622ce6` | **14.86 MB** | `frontend/public/trailers/shadow_protocol.webm` |
| `7fb5da8` | **10.41 MB** | `frontend/public/trailers/quantum_odyssey.webm` |
| `32317be` | **9.12 MB** | `frontend/public/models/cineverse_auditorium_v2.glb` |
| `81da969` | **8.55 MB** | `frontend/public/models/cineverse_auditorium.glb` |
| `e26a27e` | **8.39 MB** | `frontend/public/trailers/echoes_of_eternity.webm` |
| `6ee2c85` | **8.27 MB** | `frontend/public/trailers/neon_pulse.webm` |

---

## 3. Protected Files & Directories (Strictly Preserved — Never Removable)

The following categories of files are explicitly protected and will **never** be deleted or listed as removable:
1. **Supplied 3D Models & Textures:**
   - `frontend/public/models/*.glb`
   - `frontend/public/textures/*.jpg`, `*.png`
   - Procedural chair assets, velvet/leather textures, and floor normal maps.
2. **Seed & Catalogue Data:**
   - `backend/app/seed/tmdb_synced_cache.json`
   - `backend/app/seed/cinemas_meta.py`
   - `backend/app/seed/format_layouts.py`
   - `backend/app/seed/seeder.py` and `backend/app/seed/seed_tech_specs.py`
3. **Database Migrations & Schemas:**
   - `backend/alembic/` migrations and model definitions.
4. **All Tests & Verification Specs:**
   - `backend/tests/*`
   - `frontend/__tests__/*`
   - `frontend/e2e/*`
5. **Configuration & Documentation:**
   - `.env.example`, `backend/.env.example`
   - `docs/` documentation and architectural reports
   - `LICENSE` and `docs/asset-licences.md`
   - All files actively referenced by code, schema, or configuration.

---

## 4. Stage 2 Execution Sequence (Upon User Approval)

Once approved, Stage 2 will execute incrementally in atomic commits with full regression testing:
1. **Commit 1:** Remove root bloat files (`test_cineverse.db`, `cineverse-3d.bundle`, `cineverse-prompts-update_1.zip`) and add `.gitignore` entries.
2. **Commit 2:** Clean up unused npm dependencies (`express`, `cors`, `axios`, `clsx`, `tailwind-merge`, `framer-motion`, `meshoptimizer`, `ffmpeg-static`) and prune `node_modules`.
3. **Commit 3:** Clean up unused Python dependencies, convert `requirements.txt` to UTF-8, and add composite database indexes for technical specs.
4. **Commit 4:** Optimize backend seeder idempotency (`seed_database()` / `seed_technical_specs()`) to eliminate the 422-second dev server startup bottleneck.
5. **Commit 5:** Clean up residual drone mode code and unreferenced public media files.
6. **Commit 6:** Add `.dockerignore` files and update Dockerfiles to lean multi-stage architectures.
7. **Commit 7:** Re-run all test suites and latency benchmarks, updating `docs/PERFORMANCE.md` with before/after comparison tables.

---

**STOP:** Awaiting user approval of this cleanup plan before taking any action.
