# Phase 1 — Foundation, data model and seed

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `phases/COMMON_RULES.md` (mandatory rules for every phase), `CINEVERSE_WEBSITE_PROMPT.md` (full scope), `ANTIGRAVITY_PROMPT.md` (3D spec and coordinate rules) and `docs/PROJECT_STATUS.md` (what is already done). Do ONLY this phase. Do not start the next phase. Do not break earlier phases: run their test suites first and fix regressions. Write real code, run it, test it. Never mark an item done without evidence saved under `docs/evidence/phase-1/`. If something fails, diagnose and fix it; do not bypass it. At the end, update `docs/PROJECT_STATUS.md` and write `docs/PHASE_1_REPORT.md` with a PASS / FAIL / NOT DONE table. Then STOP and wait for review.

**Entry gate:** Repo with the three supplied assets exists (`frontend/public/models/*.glb`, `seat_layout_v2.json`, `tools/`). Nothing else required.

## Goal
A runnable monorepo where one command starts Postgres, Redis, backend and frontend, with the database schema, migrations and seed data in place and the 100 real seats loaded.

## Tasks
1. Monorepo layout per the website prompt; `docker-compose.yml` (postgres, redis, backend, frontend, mailpit); `.env.example`; Makefile or npm scripts for dev.
2. Backend: FastAPI app factory, settings via env, structured logging, request IDs, `/health` and `/ready` (checks DB and Redis), CORS, error format, OpenAPI at `/docs`.
3. SQLAlchemy 2 models and **Alembic migrations** for every table in section 3 of the website prompt. Constraints: unique confirmed booking per (showtime, seat); FKs; indexes for city+date+movie queries; `pg_trgm` extension.
4. Seed script (idempotent): 7 cities, about 8 cinemas, one auditorium with the supplied GLB registered in `theatre_assets` (with checksum), 100 seats imported from `seat_layout_v2.json` keeping `seat_id` and `node_name`, at least 12 placeholder movies with locally generated posters, showtimes for the next 7 days, `seat_inventory` rows per showtime, demo users per role, coupons.
5. Endpoints needed by later phases, read-only for now: `GET /api/v1/auditoriums/{id}/layout` (serves the JSON data from the DB, not from a static file), `GET /api/v1/showtimes/{id}/seats`.
6. Frontend: Next.js + Tailwind + shadcn skeleton, design tokens (black/charcoal/deep red), a health page that calls the backend.
7. CI script: lint, type-check, tests.

## Tests and evidence
- `docker compose up` from a clean checkout reaches healthy state; migrations apply and also roll back (`downgrade base` then `upgrade head`).
- Test: seeding twice does not duplicate rows. Test: 100 seats in DB match the JSON ids exactly. Test: inserting two confirmed bookings for one seat and showtime is rejected by the DB.
- Save command output and `/docs` screenshot.

## Security gate (see `SECURITY_SPEC.md`)
Create `docs/threat-model.md` (STRIDE per component). Baseline: Argon2id, lockfiles, gitleaks pre-commit and CI, `pip-audit`/`npm audit`, non-root containers, security headers scaffold (CSP with nonces, HSTS), CORS allow-list, request size limits, rate-limit middleware (Redis), least-privilege DB roles, no secrets in repo. Add the `movie_media`, `media_jobs`, `sessions`, `mfa_factors` tables.
Evidence in `docs/evidence/phase-1/security.md`; unresolved findings block the exit gate.

## Exit gate
Clean start works, tests green, status file updated. Report any deviation from the schema.
