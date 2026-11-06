# CineVerse — Next Session Prompt (FIX FIRST & Resume)

Paste this prompt directly into the next Antigravity session:

```markdown
Read phases/COMMON_RULES.md, DESIGN_SPEC.md, SECURITY_SPEC.md, docs/PROJECT_STATUS.md and docs/AUDIT_REPORT_2026-11-06.md.

The independent audit conducted on 2026-11-06 established that Phases 0 through 4 (Checkout Hardening, Multi-City Realism, Artwork & Trailers, 2D Dynamic Seat Map, and Procedural 3D for Every Hall) are fully implemented, verified, and performant on the production build.

Before proceeding to Phase 10 (Group Booking), resolve the "FIX FIRST" remediation items identified in the audit:

1. **Modernize Legacy Backend Tests (Finding H2)**:
   - File: `backend/tests/test_phase3_apis.py`
     - Fix `test_movie_trailer_mapping_and_fallbacks` (assert `.mp4` format instead of `.webm`).
     - Fix `test_showtime_chip_lowest_price_matches_server` (assert dynamic minimum price rule calculation).
     - Fix `test_global_search_api` (ensure case-insensitive search queries match seeded movies and cinemas).
   - File: `backend/tests/test_api_and_concurrency.py`
     - Fix `test_cities_and_movies_listing` (handle cast members schema on seeded movies).
     - Fix `test_pricing_tax_and_coupon_math` and `test_full_booking_payment_and_qr_ticket_lifecycle`.
   - Run `pytest tests/` and verify all 91 backend tests pass.

2. **Cross-Page 3D POV from Voice Agent (Finding M1 & M2)**:
   - File: `frontend/components/agent/VoiceAgentModal.tsx`
     - When `act.action === 'open_3d_seat_pov'`, if the user is not currently in an auditorium (e.g., on `/checkout` or `/movies`), navigate them to the active auditorium route (`/cinemas/{cinemaId}/auditorium/{auditoriumId}?mode=pov&seat={seatId}`).
     - Align confirmation card test ID `[data-testid="agent-card-tap-confirm"]` so `e2e/phase9_voice_agent.spec.ts` passes.

3. **Update Legacy E2E Assertion for Procedural 3D (Finding M3)**:
   - File: `frontend/e2e/realistic_city_data.spec.ts`
     - In Test 04, update the assertion to verify that 3D preview is now universally available across all auditoriums (since procedural 3D replaced the static non-3D fallback).

4. **Typography Rule Compliance (Finding L1)**:
   - File: `frontend/components/2d/SeatMap2D.tsx`
     - Ensure the accessible wheelchair icon (`♿`) is styled with `text-sm` ($\ge 14\text{px}$) rather than `10px`.

Once these four items are fixed, run the full verification suites (Vitest, Playwright, pytest, lint, tsc), update `docs/PROJECT_STATUS.md`, and stop at the exit gate for review before beginning Phase 10.
```
