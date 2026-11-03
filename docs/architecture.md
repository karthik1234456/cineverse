# CineVerse System Architecture

## 1. System Overview

CineVerse is a next-generation movie ticket booking platform built with a high-performance decoupled architecture. Its signature differentiator is an interactive, physically-accurate 3D auditorium seat selection experience powered by Three.js and React Three Fiber, coupled with real-time seat inventory synchronization and an atomic seat hold engine.

```mermaid
flowchart TD
    subgraph Client ["Client Browser / Mobile PWA"]
        A[Next.js 14 App Router]
        B[React Three Fiber / Three.js 3D Canvas]
        C[Zustand State Store]
        D[TanStack Query Polling]
        E[Native WebSocket Client]
    end

    subgraph ReverseProxy ["Edge & API Layer"]
        F[Next.js API Rewrites / Reverse Proxy]
    end

    subgraph Backend ["FastAPI Core Services"]
        G[FastAPI v1 REST Endpoints]
        H[WebSocket Connection Manager]
        I[Hold Engine & Sweeper Task]
        J[Booking & Pricing Calculator]
        K[Payment & HMAC Ticket Service]
        L[Auth & RBAC Service]
    end

    subgraph Storage ["State & Persistence"]
        M[(PostgreSQL 18 / SQLite Async Engine)]
        N[(Redis / Fakeredis TTL Store)]
    end

    Client -->|HTTP / REST| F
    F -->|Proxy /api/v1| G
    E -->|WS /ws/showtimes/{id}| H
    G --> L
    G --> J
    G --> I
    G --> K
    I --> N
    I --> M
    H --> N
    J --> M
    K --> M
```

---

## 2. Frontend Architecture (Next.js 14 App Router)

### 2.1 Route Topology
- `/`: Cinematic landing page featuring city-aware movie carousel, format chips (IMAX 3D, 4DX, Dolby Atmos), Now Showing catalog, 3D auditorium showcase banner, and top cinema complexes.
- `/movies`: Multi-facet movie exploration with genre, language, format, and search query filters.
- `/movies/[id]`: Movie synopsis, embedded YouTube trailer modal, cast & crew roster, 7-day horizontal date selector, and cinema showtimes grid with availability indicators (`AVAILABLE`, `FAST_FILLING`, `ALMOST_FULL`).
- `/cinemas`: Cinema directory categorized by city with amenities, screen counts, and location metadata.
- `/cinemas/[cinemaId]`: Specific cinema facility showcase with active screens and today's schedule.
- `/cinemas/[cinemaId]/auditorium/[auditoriumId]?showtime={id}`: Fullscreen 3D auditorium seat selection, POV sightline preview, seat inspection metrics, and F&B add-on upsell modal.
- `/checkout`: 5-minute atomic countdown hold timer with one-click "+3m" extend, dynamic price breakdown (tickets, convenience fee ₹35/ticket, 18% GST, F&B combos, promotional discounts), contact form, and simulated Razorpay test mode authorization.
- `/booking/[id]`: Confirmed booking confirmation receipt featuring verifiable HMAC SHA-256 signed QR code e-ticket, print ticket view, and Apple/Google Calendar (`.ics`) file generation.
- `/profile`: User booking management dashboard with Upcoming, Past, and Cancelled filter tabs, plus 75% refund cancellation action.
- `/admin`: Executive business intelligence console with real-time revenue telemetry, screen occupancy percentages, top grossing movies, and booking velocity audits.

### 2.2 3D Graphics Engine & Coordinate Conventions
The 3D auditorium experience conforms strictly to right-handed Y-up space:
- **World Coordinate Frame**:
  - `+X`: Audience right (facing the screen)
  - `-X`: Audience left (facing the screen)
  - `+Y`: Ceiling / vertical elevation
  - `-Y`: Floor
  - `+Z`: Rear of auditorium (seating rows A through J rise from front `z ≈ -8.0` to back `z ≈ 0.5`)
  - `-Z`: Front of auditorium / Projection screen positioned at `z ≈ -1.25`
- **Sightline Geometry & POV Mode**:
  When a patron selects a seat or enters POV mode, the virtual camera transitions smoothly via spherical interpolation (`lerp`) to that seat's exact eye position (`eye_position_gltf_y_up`), orienting its optical forward vector directly toward screen center `(0.0, 5.55, -1.255)` with human field-of-view (`fov = 57.2°`).
- **Real-Time Mesh Decoupling**:
  100 individual seats are rendered using instanced or batch-optimized geometries. Status changes (`available` -> white/slate, `held` -> yellow/amber, `booked` -> dark crimson, `selected` -> glowing cinema red) are applied dynamically without geometry rebuilds.

---

## 3. Backend Architecture (FastAPI & Async Engine)

### 3.1 Concurrency & Atomic Seat Holds
To prevent double bookings and race conditions when multiple users vie for the same high-demand seat:
1. **Atomic Lock**: A seat reservation request issues an atomic check-and-set query inside an async database transaction (`SELECT ... WHERE status = 'AVAILABLE' FOR UPDATE` on PostgreSQL, or row versioning on SQLite).
2. **Dual-Layer Expiry**:
   - In Redis: A key `hold:{showtime_id}:{seat_id}` is set with a 300-second TTL.
   - In SQL (`seat_inventory`): `status = 'HELD'`, `hold_id = <uuid>`, and `hold_expires_at = NOW() + 5m`.
3. **Background Sweeper Task**: An asynchronous background coroutine runs every 10 seconds, identifying any expired holds (`hold_expires_at <= NOW() AND status = 'HELD'`), resetting them to `'AVAILABLE'`, and broadcasting the release over WebSockets.
4. **WebSocket Fan-Out**: Any hold, release, or booking confirmation instantly broadcasts a JSON payload to `/ws/showtimes/{showtime_id}`, enabling all connected clients to update their 3D canvas colors without refreshing.

### 3.2 Pricing & Tax Rules Engine
- **Convenience Fee**: Flat ₹35.00 per ticket.
- **GST Calculation**: Exactly 18% applied on the convenience fee (`convenience_fee * 0.18`), compliant with Indian ticketing tax norms.
- **Concessions & Addons**: Line-item subtotaling for cinema combos, caramel popcorn, beverages, and nacho boxes.
- **Coupons**: Percentage (e.g. `CINEVERSE50` with max ₹150 cap) or flat (e.g. `MOVIE100`) discounts applied before the grand total calculation.

### 3.3 Verifiable QR Admission Code Engine
Each confirmed booking generates an admission ticket containing a cryptographic HMAC SHA-256 signature generated from:
```
HMAC-SHA256(secret_key, "{booking_code}|{showtime_id}|{sorted_seat_ids}")
```
This signature is embedded into a high-density QR code rendered as a base64 PNG data URI, allowing cinema turnstile scanners to cryptographically verify ticket authenticity offline without database access.

