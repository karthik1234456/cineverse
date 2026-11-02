# Architecture Decision Record (ADR) — CineVerse

## Context & Objectives
CineVerse is a production-grade movie-ticket booking platform modeled on industry standards (BookMyShow / PVR INOX / Paytm Insider), uniquely differentiated by a genuine 3D WebGL auditorium experience allowing patrons to preview views directly from their seats.

This document logs architectural tradeoffs, technical choices, and rationale.

---

### ADR-001: Monorepo Structure & Monolithic Architecture
- **Decision**: Keep all components inside a clean monolithic repository:
  - `frontend/`: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui primitives, Three.js, React Three Fiber, Zustand, TanStack Query, Framer Motion.
  - `backend/`: Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic.
  - `docs/`: System documentation, architecture diagrams, decision logs, evidence.
  - `tools/`: Data generators, 3D asset inspection scripts.
- **Rationale**: Eliminates microservice operational complexity, provides single-command atomic builds and testing, and allows shared type contracts.

---

### ADR-002: Dual-Engine Database Strategy (PostgreSQL + SQLite async fallback)
- **Decision**: Primary target is PostgreSQL 16+ via `asyncpg`. For local environments without an active PostgreSQL daemon and for fast CI test isolation, the engine supports `sqlite+aiosqlite` transparently.
- **Implementation**: Models use standard SQLAlchemy portable column types (e.g. `JSON` rather than dialect-specific `JSONB`, portable timestamps with UTC timezone handling).
- **Rationale**: Guarantees zero friction for developers while maintaining full ACID compliance and `SELECT ... FOR UPDATE` row locks in PostgreSQL.

---

### ADR-003: Redis Coordination with Resilient Fallback
- **Decision**: Use Redis for seat-hold countdowns (10-minute TTL), distributed locks, and WebSocket channel fan-out. If Redis is unreachable during local developer testing or offline evaluation, the backend gracefully falls back to a thread-safe in-memory TTL store (`fakeredis` / `MemorySeatHoldStore`) matching the exact asynchronous Redis interface.
- **Rationale**: Prevents hard crashes when developers run the backend outside Docker while strictly preserving production Redis semantics.

---

### ADR-004: Concurrency & Seat-Hold Lifecycle
- **Decision**:
  - Seat states follow strict lifecycle: `AVAILABLE` -> `HELD` -> `PAYMENT_PENDING` -> `BOOKED`.
  - Seat inventory is per-showtime (`seat_inventory` table).
  - Holds are acquired atomically with a 10-minute TTL.
  - PostgreSQL unique constraint on `(showtime_id, seat_id)` for active bookings guarantees that two users can never simultaneously book the same seat.
  - A background sweeper releases expired holds back to `AVAILABLE` and broadcasts state updates to the showtime's WebSocket channel.

---

### ADR-005: 3D Auditorium Integration
- **Decision**: Embed the Phase 3 3D auditorium module into the full booking flow at `/cinemas/[cinemaId]/auditorium/[auditoriumId]?showtime=[showtimeId]`.
- **Details**:
  - Uses the verified `cineverse_auditorium_v2.web.glb` (optimized meshopt, 1.06MB) and `seat_layout_v2.json`.
  - Connects to backend `GET /api/v1/showtimes/{id}/seats` and live WebSocket `/ws/showtimes/{id}` for real-time status updates.
  - Accessible 2D fallback toggle available for low-power or non-WebGL devices, but 3D view remains the premier default experience.

---

### ADR-006: Payments, Tickets & Webhook Idempotency
- **Decision**:
  - Integrate Razorpay test mode with server-side order generation and HMAC-SHA256 signature verification.
  - Support simulated test checkout in local dev when gateway keys are in test mode.
  - Webhook processor uses a dedicated `payment_events` table for idempotency to reject duplicate or out-of-order webhooks safely.
  - Confirmed bookings generate signed e-tickets with verifiable QR payloads, printable views, and .ics calendar attachments.

---

### ADR-007: Authentication & RBAC
- **Decision**:
  - Token-based auth with short-lived JWT access tokens and rotating refresh tokens.
  - Dual login modes: Email + Argon2/bcrypt password, and Phone OTP with a pluggable provider interface (mock/console provider for dev).
  - Four explicit roles: `customer`, `cinema_manager`, `support`, `admin`.

