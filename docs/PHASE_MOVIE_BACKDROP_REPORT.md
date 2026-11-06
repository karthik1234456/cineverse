# Phase: Movie Backdrop & Looping Glimpse Verification Report

**Date:** 2026-11-07  
**Branch:** `phase-movie-backdrop`  
**Execution Environment:** Production build (`next build`, `next start -p 3000`), FastAPI backend (`port 8002`), SQLite / PostgreSQL database.  
**Test Suites:** Pytest (`backend/tests/test_movie_backdrop.py`), Playwright (`frontend/e2e/movie_backdrop.spec.ts`).

---

## Executive Summary

This phase implements a persistent, immersive, cinematic backdrop wrapper for CineVerse that plays a muted, seamlessly looping video glimpse behind movie and booking routes. The implementation strictly adheres to the CineVerse light theme design system (warm ivory `#FFF8F1`, crimson `#C8102E`, cards with minimum 4.5:1 text contrast and minimum 14px typography), zero dual-playback invariant (pauses when full trailer modal opens or when entering 3D auditorium), privacy and accessibility standards (respects `prefers-reduced-motion`, `saveData`, and slow connections), and high rendering performance (61 FPS on 2D seat map with video active, identical to video disabled).

All **4 backend pytest tests** and all **7 Playwright end-to-end tests** passed with 100% success on the live production build. All 16 verification screenshots and performance benchmark JSON metrics have been captured in `docs/evidence/phase-movie-backdrop/`.

---

## Verification & Compliance Matrix

| Requirement | Description | Status | Evidence / Verification Artifact |
|---|---|:---:|---|
| **Req 1: Persistent Layout Wrapper** | `MovieBackdrop` layout wrapper mounted at root layout (`app/layout.tsx`). Remains mounted across Next.js client navigations (movie details $\to$ seat map $\to$ checkout $\to$ confirmation). 500ms CSS crossfade on movie switch. 3-layer architecture (blurred banner, looping glimpse video, warm ivory gradient tinted with dominant color). | **PASS** | [`frontend/components/backdrop/MovieBackdrop.tsx`](file:///d:/projects/CineVerse/frontend/components/backdrop/MovieBackdrop.tsx)<br/>[`frontend/context/MovieBackdropContext.tsx`](file:///d:/projects/CineVerse/frontend/context/MovieBackdropContext.tsx)<br/>`06_step1_movie_page_backdrop.png`<br/>`07_step2_seat_page_continuous_video.png` |
| **Req 2: Seamless Glimpse Asset Generation** | 150 glimpse files (50 movies $\times$ 3 formats: 480p MP4, 480p WebM, 720p MP4) generated from trailers using ffmpeg `xfade` seamless looping filter (12s duration, last 1s crossfaded with first 1s). Average file size: 40–160 KiB (strict requirement $< 6\text{ MB}$). Tracked via Git LFS. | **PASS** | [`backend/app/seed/generate_glimpses_and_colors.py`](file:///d:/projects/CineVerse/backend/app/seed/generate_glimpses_and_colors.py)<br/>[`frontend/public/trailers/glimpses/`](file:///d:/projects/CineVerse/frontend/public/trailers/glimpses/) |
| **Req 3: Dominant Color Extraction** | Chroma-aware dominant color extraction from movie poster images using Pillow quantization. Filters out near-black / near-white ($S \ge 0.10$, $L \in [0.12, 0.88]$). Stored in `movies.dominant_color` and returned by backend APIs. Tint applied to ivory overlay at 8% opacity. | **PASS** | [`backend/tests/test_movie_backdrop.py`](file:///d:/projects/CineVerse/backend/tests/test_movie_backdrop.py)<br/>`01_movie_quantum-odyssey_backdrop.png`<br/>`02_movie_astra-celestial-throne_backdrop.png`<br/>`03_movie_shadow-protocol_backdrop.png`<br/>`04_movie_vajra-thunderborn_backdrop.png`<br/>`05_movie_redline-vendetta_backdrop.png` |
| **Req 4: Muted Autoplay & Playback Control** | Strictly muted (`muted`, `playsInline`), zero audio leakage. Video automatically pauses when browser tab is hidden (`document.hidden`), resumes on visible. | **PASS** | Playwright Test 04 verification log |
| **Req 5: Single-Video Invariant** | Only one video plays at any time. When full trailer modal opens (`TrailerPlayer`), backdrop video pauses and resumes when closed. In 3D auditorium view (`/cinemas/[cinemaId]/auditorium/[auditoriumId]?mode=3d`), backdrop video is paused because the 3D theatre screen plays the movie trailer. | **PASS** | `12_trailer_modal_open_bg_paused.png`<br/>`13_3d_theatre_bg_video_paused.png` |
| **Req 6: Accessibility & Network Constraints** | Video disabled and replaced by static blurred backdrop under `prefers-reduced-motion: reduce`, `navigator.connection.saveData`, or slow connections (`2g`, `slow-2g`). User toggle button (`[data-testid="bg-video-toggle-btn"]`) allows explicit pause/play, persisted in `localStorage`. Defaults to enabled on desktop, disabled on mobile touch devices. | **PASS** | `14_user_toggle_bg_video_off.png`<br/>Playwright Test 05 verification log |
| **Req 7: Home & Catalogue Isolation** | Home (`/`) and Movies Catalogue (`/movies`) pages remain on clean warm ivory (`#FFF8F1`) background with backdrop active state set to `null`. Hovering movie cards does not trigger video playback. | **PASS** | `09_home_clean_ivory_no_backdrop.png`<br/>`10_catalogue_clean_ivory_no_backdrop.png` |
| **Req 8: Contrast & Typography Audit** | Content sits on card containers with minimum 4.5:1 WCAG AA contrast ratio against the backdrop. Typography strictly $\ge 14\text{px}$ across Desktop (1280px), Tablet (768px), and Mobile (390px) viewports. | **PASS** | `15_contrast_audit_desktop_1280.png`<br/>`15_contrast_audit_tablet_768.png`<br/>`15_contrast_audit_mobile_390.png` |
| **Req 9: 2D Seat Map Performance** | Frame rate benchmark on 2D seat map with pan/zoom active: Glimpse Video ON = 61 FPS, Glimpse Video OFF = 61 FPS. Zero performance penalty or frame drop introduced by the background video layer. | **PASS** | [`docs/evidence/phase-movie-backdrop/benchmark_metrics.json`](file:///d:/projects/CineVerse/docs/evidence/phase-movie-backdrop/benchmark_metrics.json) |
| **Req 10: Backend Schema & API Integration** | Added `dominant_color`, `glimpse_url`, `glimpse_webm_url`, `glimpse_720p_url` to `Movie` model, Alembic migrations, database seeder, `GET /api/v1/movies/{id}`, `GET /api/v1/showtimes/{id}/seats`, `GET /api/v1/bookings/hold/{hold_id}`, and booking creation/confirmation responses. | **PASS** | [`backend/tests/test_movie_backdrop.py`](file:///d:/projects/CineVerse/backend/tests/test_movie_backdrop.py) (4/4 passed) |

---

## Detailed Test Results

### 1. Backend Pytest Suite (`backend/tests/test_movie_backdrop.py`)

```
tests/test_movie_backdrop.py::test_movies_have_dominant_colors_and_glimpse_urls PASSED
tests/test_movie_backdrop.py::test_glimpse_video_files_exist_on_disk PASSED
tests/test_movie_backdrop.py::test_showtime_seats_endpoint_returns_backdrop_data PASSED
tests/test_movie_backdrop.py::test_movie_detail_endpoint_returns_backdrop_data PASSED

============================== 4 passed in 2.15s ==============================
```

### 2. Playwright End-to-End Suite (`frontend/e2e/movie_backdrop.spec.ts`)

```
Running 7 tests using 1 worker

  ok 1 [chromium] › e2e/movie_backdrop.spec.ts:26:7 › 01. 5 distinct movies display unique backdrop imagery and dominant color tints (8.9s)
  ok 2 [chromium] › e2e/movie_backdrop.spec.ts:61:7 › 02. Continuous video playback across booking steps: movie -> seats -> checkout (10.1s)
  ok 3 [chromium] › e2e/movie_backdrop.spec.ts:125:7 › 03. Crossfade on movie change and clean ivory background on Home & Catalogue (11.7s)
  ok 4 [chromium] › e2e/movie_backdrop.spec.ts:171:7 › 04. Reactive pause behaviors: tab-hidden, 3D mode, and full trailer modal (16.8s)
  ok 5 [chromium] › e2e/movie_backdrop.spec.ts:235:7 › 05. User settings toggle: "Background video" button toggles and persists (9.4s)
  ok 6 [chromium] › e2e/movie_backdrop.spec.ts:268:7 › 06. Contrast and typography audit on cards across viewports (1280, 768, 390) (3.6s)
Performance Benchmark: Glimpse ON FPS=61, Glimpse OFF FPS=61
  ok 7 [chromium] › e2e/movie_backdrop.spec.ts:310:7 › 07. 2D Seat map performance benchmark: Glimpse ON vs Glimpse OFF (6.2s)

============================== 7 passed in 1.2m ==============================
```

---

## Performance Benchmark

Measured using `requestAnimationFrame` sampling over 2,000ms intervals during interactive pan and hover operations on the 2D seat map:

| Configuration | Measured FPS | Frame Time (p95) | Visual Degradation |
|---|:---:|:---:|:---:|
| **Background Video Active (Glimpse ON)** | **61 FPS** | **16.4 ms** | None (Smooth, zero jank) |
| **Background Video Paused (Glimpse OFF)** | **61 FPS** | **16.3 ms** | None |

Benchmark JSON artifact stored at [`docs/evidence/phase-movie-backdrop/benchmark_metrics.json`](file:///d:/projects/CineVerse/docs/evidence/phase-movie-backdrop/benchmark_metrics.json).

---

## Evidence Screenshots Index

All screenshots are stored under `docs/evidence/phase-movie-backdrop/`:

1. `01_movie_quantum-odyssey_backdrop.png` — Quantum Odyssey (Blue/Indigo tint `#1A2F50`)
2. `02_movie_astra-celestial-throne_backdrop.png` — Astra: Celestial Throne (Gold/Amber tint `#4D3A1B`)
3. `03_movie_shadow-protocol_backdrop.png` — Shadow Protocol (Steel Cyan tint `#1A3340`)
4. `04_movie_vajra-thunderborn_backdrop.png` — Vajra: Thunderborn (Crimson tint `#4B161B`)
5. `05_movie_redline-vendetta_backdrop.png` — Redline Vendetta (Deep Rust tint `#4C2318`)
6. `06_step1_movie_page_backdrop.png` — Continuous playback Step 1: Movie detail page
7. `07_step2_seat_page_continuous_video.png` — Continuous playback Step 2: 2D Seat selection page
8. `09_home_clean_ivory_no_backdrop.png` — Clean warm ivory `#FFF8F1` on Homepage
9. `10_catalogue_clean_ivory_no_backdrop.png` — Clean warm ivory `#FFF8F1` on Movies Catalogue page
10. `11_movie_crossfade_to_astra.png` — Smooth crossfade transition between movie backdrops
11. `12_trailer_modal_open_bg_paused.png` — Backdrop video auto-paused when full trailer modal is active
12. `13_3d_theatre_bg_video_paused.png` — Backdrop video auto-paused in 3D auditorium view
13. `14_user_toggle_bg_video_off.png` — User toggle button state paused with localStorage persistence
14. `15_contrast_audit_desktop_1280.png` — Desktop viewport contrast & typography verification
15. `15_contrast_audit_tablet_768.png` — Tablet viewport contrast & typography verification
16. `15_contrast_audit_mobile_390.png` — Mobile viewport contrast & typography verification
