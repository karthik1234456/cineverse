# CineVerse — Production Movie Ticket Booking Platform with Interactive 3D Auditorium

> **"Experience your seat before you book."**

CineVerse is a full-featured, production-grade movie-ticket booking website comparable in scope to BookMyShow, PVR INOX, and Paytm Insider, whose signature differentiator is **choosing seats inside a physically-accurate 3D auditorium and previewing the sightline POV from each seat**.

---

## 1. Key Platform Features

- **Signature 3D Auditorium Seat Selection**:
  - Photorealistic Three.js / React Three Fiber interactive 3D theatre.
  - Orbit camera with pitch/yaw limits, smooth cinematic lerp transitions.
  - One-click **Seat POV Sightline Preview**: dynamically positions the camera at the exact eye coordinates of any seat, calculating horizontal gaze offset, vertical viewing angle, and screen coverage.
  - Real-time seat status visualization (Available, Held, Booked, Selected).
  - Seat comparison view and Show Lights mode (lights dim on preview).
- **Comprehensive Ticketing Platform**:
  - **7 Indian Metro Cities**: Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Pune, Kolkata with instant switcher and local storage persistence.
  - **Multi-Facet Movie Catalog**: Now Showing & Coming Soon tabs, genre/format/language filters, instant search, and YouTube trailer modal.
  - **Cinema Showtimes Grid**: 7-day date strip, real-time seat availability chips (`AVAILABLE`, `FAST_FILLING`, `ALMOST_FULL`), and cinema facility badges.
  - **Concessions & Add-ons**: Gourmet popcorn, sodas, nachos, and combo bites with quantity steppers and cart integration.
  - **Atomic Seat Hold Engine**: High-concurrency 5-minute atomic holds with visual countdown timer and one-click "+3m" extend action.
  - **Dynamic Price & Tax Calculator**: Per-seat category pricing (Front, Prime, Premier), ₹35 convenience fee per ticket, exact 18% GST calculation, and promo code discounts (`CINEVERSE50`, `FIRSTSHOW`, `MOVIE100`).
  - **Razorpay Sandbox Integration**: Order generation, HMAC SHA-256 signature verification, and idempotent webhook handling.
  - **Cryptographic QR Admission Ticket**: Verifiable HMAC SHA-256 signed QR code rendered as high-res PNG data URI, with print ticket view and Apple/Google Calendar (`.ics`) download.
  - **User Profile & Self-Service Cancellation**: Booking history tabs with instant 75% refund policy cancellation.
  - **Executive Admin Analytics Console**: Live telemetry displaying gross revenue, confirmed bookings, tickets sold, overall screen occupancy percentage, and top grossing movies.

---

## 2. Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Three.js, React Three Fiber, Drei, Zustand, TanStack Query, Framer Motion, Lucide Icons.
- **Backend**: Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic, PostgreSQL 18 / asyncpg (with zero-config SQLite aiosqlite fallback), Redis (with automatic fakeredis fallback).
- **Payment & Security**: Razorpay test mode, HMAC SHA-256 signatures, bcrypt password hashing, JWT access & refresh tokens, RBAC dependencies.
- **Testing**: Playwright (E2E with SwiftShader headless WebGL), Pytest (concurrency race conditions, pricing math, webhooks), Vitest (3D geometry and sightline math).

---

## 3. Quick Start & Local Execution

### Option A: Docker Compose (Single Command)

```bash
docker compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Standalone Execution

#### 1. Backend Setup (FastAPI)
```bash
# Navigate to backend and create virtual environment
cd backend
python -m venv .venv
.\.venv\Scripts\activate   # Windows (or source .venv/bin/activate on Linux/macOS)

# Install dependencies
pip install -r requirements.txt

# Run database seeder (seeds 7 cities, 8 cinemas, 12 movies, 100 3D seats, showtimes, coupons, F&B)
$env:PYTHONPATH="backend"
python backend/app/seed/seeder.py

# Start the FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

#### 2. Frontend Setup (Next.js)
```bash
# In a new terminal, navigate to frontend
cd frontend
npm install

# Build production bundle
npm run build

# Start production server
npm run start -p 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Default Seed Credentials

| Role | Email | Password | OTP (Dev) |
| :--- | :--- | :--- | :--- |
| **Platform Administrator** | `admin@cineverse.in` | `Admin@123` | `123456` |
| **Cinema Manager** | `manager@cineverse.in` | `Manager@123` | `123456` |
| **Demo Customer** | `patron@example.com` | `Patron@123` | `123456` |

---

## 5. Automated Verification & Test Results

CineVerse includes an extensive automated test suite covering backend concurrency, math calculations, and full end-to-end browser journeys.

### Run All Test Suites

```bash
# 1. Backend Pytest (Concurrency, Pricing, Webhooks, HMAC signatures)
cd backend
pytest -v

# 2. Frontend Vitest (3D Sightline Math & GLB Integrity)
cd frontend
npm run test

# 3. Playwright E2E Full Website Journey (8 tests, serial browser flow)
cd frontend
npx playwright test e2e/website_full_flow.spec.ts

# 4. Playwright 3D Auditorium Deep Inspection (10 tests)
cd frontend
npx playwright test e2e/auditorium.spec.ts
```

### Test Summary: 37 / 37 Tests Passing (100% Pass Rate)

| Test Suite | Total Tests | Status | Scope |
| :--- | :---: | :---: | :--- |
| **FastAPI Pytest** | **9** | **PASS** | Concurrency race condition, hold expiry, pricing/tax math, webhook idempotency, cancellations, RBAC |
| **Frontend Vitest** | **10** | **PASS** | Camera POV angles, screen distance, bounding boxes, GLB model node mappings |
| **Playwright Full Flow** | **8** | **PASS** | Complete browser journey from home -> 3D seat -> F&B -> checkout -> QR ticket -> profile -> admin |
| **Playwright 3D Suite** | **10** | **PASS** | Orbit controls, seat inspection, POV transitions, multi-seat compare, mobile viewport, WebGL fallback |

---

## 6. Verification Evidence & Screenshots

All screenshots are programmatically captured during Playwright test runs and preserved in `docs/evidence/` and `docs/screenshots/`:

| Step / Flow | Evidence Screenshot | Verification Details |
| :--- | :--- | :--- |
| **01. Homepage & City Selector** | `docs/evidence/01_homepage_city_selector.png` | Hero carousel, 7-city selector modal, 3D differentiator banner |
| **02. Movies Catalog** | `docs/evidence/02_movies_catalog.png` | Multi-facet format chips (IMAX 3D, 4DX, Dolby Atmos), genre filter, search |
| **03. Movie Details & 7-Day Grid** | `docs/evidence/03_movie_detail_showtimes.png` | Synopsis, cast roster, 7-day date strip, real-time availability color chips |
| **04. 3D Seat POV Selection** | `docs/evidence/04_3d_seat_pov_view.png` | Physically-accurate 3D auditorium, eye sightline POV, distance/angles panel |
| **05. Concessions & Add-ons** | `docs/evidence/05_fnb_addons_modal.png` | Combos, popcorn, nachos, sodas with quantity steppers |
| **06. Checkout & Hold Timer** | `docs/evidence/06_checkout_with_hold_timer.png` | 5-minute atomic countdown timer, coupon discount, ₹35 fee + 18% GST breakdown |
| **07. Confirmed Booking E-Ticket** | `docs/evidence/07_booking_confirmed_qr_ticket.png` | Cryptographic HMAC SHA-256 signed QR admission ticket, .ics calendar export |
| **08. Profile & Cancellation** | `docs/evidence/08_profile_bookings_history.png` | Upcoming/Past bookings, self-service cancellation with 75% refund policy |
| **09. Admin Analytics Console** | `docs/evidence/10_admin_analytics.png` | Executive console with gross revenue, tickets sold, screen occupancy percentage |

---

## 7. Architecture Documentation

Detailed architectural and design specifications are maintained in `docs/`:
- [`docs/architecture.md`](./docs/architecture.md) — System components, data flows, 3D coordinates, and hold lifecycle.
- [`docs/database.md`](./docs/database.md) — Entity-relationship diagram, table schemas, and indexing strategy.
- [`docs/api.md`](./docs/api.md) — REST API specifications and WebSocket protocol.
- [`docs/security.md`](./docs/security.md) — Authentication, HMAC QR codes, webhook idempotency, and RBAC rules.
- [`docs/decisions.md`](./docs/decisions.md) — Architecture decision records (ADRs).
