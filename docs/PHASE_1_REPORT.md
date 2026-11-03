# Phase 1 Report — Foundation, Data Model, and Seed

**Phase Status**: **PASS**  
**Execution Date**: 2026-11-03  
**Evidence Directory**: `docs/evidence/phase-1/`

---

## 1. Deliverables & Verification Table

| Item | Task Description | Status | Evidence / Verification Notes |
|:---|:---|:---:|:---|
| **1.1** | Monorepo layout per prompt; `docker-compose.yml` (Postgres, Redis, Backend, Frontend, Mailpit); `.env.example`; npm/make dev scripts | **PASS** | Verified `package.json` scripts (`dev:frontend`, `dev:backend`, `test:frontend`, `test:backend`, `seed`), verified `docker-compose.yml` with healthchecks. |
| **1.2** | FastAPI application factory (`create_app`), settings via env, structured logging, request IDs (`X-Request-ID`), `/health` and `/ready` probes, standardized error handling, OpenAPI at `/docs` | **PASS** | Verified via `pytest backend/tests/test_phase1.py::test_health_and_readiness` and captured OpenAPI documentation screenshot at `docs/evidence/phase-1/01_openapi_docs.png`. |
| **1.3** | SQLAlchemy 2 models and async **Alembic migrations** for all entities in section 3. Unique constraint for confirmed bookings on `(showtime_id, seat_id)`, foreign keys, composite indexes (`ix_showtimes_cinema_movie_date`), and `pg_trgm` extension | **PASS** | Verified full roundtrip migration: `alembic downgrade base` and `alembic upgrade head`. Output saved in `docs/evidence/phase-1/alembic_output.txt`. Constraint test `test_two_confirmed_bookings_rejected` passed. |
| **1.4** | Idempotent Seed Script: 7 cities, 8 cinemas, auditoriums with registered GLB assets & SHA-256 checksums, 100 seats imported 1-to-1 from `seat_layout_v2.json`, 12 movies, showtimes for 7 days, seat inventory slots, demo role users, active coupons | **PASS** | Executed twice with zero duplicate rows. Tested via `pytest backend/tests/test_phase1.py::test_seeding_twice_idempotent` and `test_100_seats_match_json_ids`. Output saved in `docs/evidence/phase-1/seed_output.txt`. |
| **1.5** | Core Read Endpoints: `GET /api/v1/auditoriums/{id}/layout` (served directly from DB JSON, not static file) and `GET /api/v1/showtimes/{id}/seats` | **PASS** | Tested via `pytest backend/tests/test_phase1.py::test_auditorium_layout_served_from_db` and `test_showtimes_and_seats_inventory`. |
| **1.6** | Frontend: Next.js 14 + Tailwind CSS + shadcn theme tokens (`#0A0A0C`, `#E50914`, gold accents), health page | **PASS** | Verified Next.js app structure, tailwind configuration, theme tokens, and health page `frontend/app/health/page.tsx`. |
| **1.7** | CI & Test Scripts: Lint, type-check, and automated test commands in monorepo root | **PASS** | Automated suite with 14 passing backend pytest tests (`pytest_output.txt`), 10 passing frontend Vitest tests, and Playwright end-to-end tests. |

---

## 2. Test Execution Summary

- **Backend Pytest Suite (`backend/tests`)**: 14 / 14 passed (100%)
  - `test_seeding_twice_idempotent`: PASSED
  - `test_100_seats_match_json_ids`: PASSED (verified all 100 seat IDs: A01..J10)
  - `test_two_confirmed_bookings_rejected`: PASSED (IntegrityError on duplicate `(showtime_id, seat_id)`)
  - `test_health_and_readiness`: PASSED (checks DB and Redis status)
  - `test_auditorium_layout_served_from_db`: PASSED (validates DB layout JSON)
  - Full suite log: [docs/evidence/phase-1/pytest_output.txt](file:///d:/projects/CineVerse/docs/evidence/phase-1/pytest_output.txt)

- **Database Migrations (`Alembic`)**:
  - Full rollback (`downgrade base`) and re-application (`upgrade head`) succeeded cleanly.
  - Log: [docs/evidence/phase-1/alembic_output.txt](file:///d:/projects/CineVerse/docs/evidence/phase-1/alembic_output.txt)

- **OpenAPI Documentation**:
  - Captured interactive Swagger UI at `http://127.0.0.1:8000/docs`:
  - Screenshot: [docs/evidence/phase-1/01_openapi_docs.png](file:///d:/projects/CineVerse/docs/evidence/phase-1/01_openapi_docs.png)

---

## 3. Schema & Implementation Notes

- **Alembic async engine configuration**: `backend/alembic/env.py` dynamically resolves `app.core.config.settings.DATABASE_URL` and targets `Base.metadata`.
- **Theatre asset integrity**: `seeder.py` computes dynamic SHA-256 hash (`e1289e1ad3aa2b0fbff31633f016cb47e996dfc4d06dca6347b491d8153c3d9d`) for `auditorium_100.glb` and registers it in `theatre_assets`.
- **Constraint enforcement**: `BookingSeat` table contains `UniqueConstraint("showtime_id", "seat_id", name="uq_booking_seats_showtime_seat")` ensuring zero duplicate seat bookings at the database engine level.
