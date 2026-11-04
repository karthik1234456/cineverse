# CineVerse — Technical Audit Report (2026-11-03)

**Auditor:** Independent Technical Auditor & QA Lead  
**Audit Scope:** Full codebase, database migrations, security gates, test suites (backend pytest, frontend Vitest, Playwright E2E, lint, `tsc --noEmit`), asset checksums, false-completion detection, and operational readiness across Phases 1 through 12.  
**Mode:** REPORT-ONLY (No application code modified).

---

## 1. Executive Summary

1. **Overall Completion:** **75% of full project scope** (Phases 1, 4, 6, 7, 8, 9, 12 are largely functional; Phase 2 & 3 have test harness failures; Phase 5 has hardcoded checkout stubbing; Phases 10 & 11 were skipped entirely and are **NOT STARTED**).
2. **What Works Today:** The core 3D interactive auditorium, 2D seat map with bidirectional selection sync, concurrency seat holding (50-client race condition verified), real-time WebSockets, JWT authentication, Voice Agent with 4 safety gates, staff turnstile scanning PWA, and zero-PII Kitchen Display System (KDS).
3. **What is Blocking:**
   - **Database State Pollution in Test Runs**: Running `test_phase12_operations.py` mutates `Showtime 1` (advancing it 2 days into the future) and burns user 3's monthly transfer quota, causing subsequent runs of `test_api_and_concurrency.py` and `phase3_browse_journey.spec.ts` to fail.
   - **Phase 5 Checkout is Stubbed**: The frontend checkout page (`frontend/app/checkout/page.tsx:235-368`) displays `[Phase 4 Stub] Payment Gateway Preview` and sends a hardcoded mock signature (`test_signature_valid`), which the backend accepts via a hardcoded backdoor in `verify_razorpay_hmac` (`payment_service.py:24`).
   - **TypeScript Compilation Failures (`tsc --noEmit`)**: Two type errors exist in `e2e/phase4_booking_engine.spec.ts:210,212` (`GPUCanvasContext` incompatible with `CanvasRenderingContext2D`).
   - **Playwright Test Fragility**: `auditorium.spec.ts` fails on step 01 due to console errors capturing `net::ERR_FAILED`, and `website_full_flow.spec.ts` times out because the City Selector modal backdrop intercepts clicks.
4. **Discrepancy with `docs/PROJECT_STATUS.md`:** `PROJECT_STATUS.md` claimed Phase 5 (Payments) was completely passed, masking the fact that the frontend checkout is an unintegrated Phase 4 stub and the backend contains a signature bypass. Furthermore, Phase 10 and 11 are not in `PROJECT_STATUS.md` because Phase 12 was executed out of sequence.
5. **Auditor Recommendation:** **`FIX FIRST`**. Do NOT proceed to Phase 10 or 11 until the 4 Critical/High findings are resolved.

---

## 2. Environment & Ground Truth Results

- **Operating System:** Windows 11 Home Single Language (10.0.26300, 64-bit)
- **Node Version:** v24.11.1 | **NPM Version:** 11.6.2
- **Python Version:** 3.13.7 (Virtualenv: `backend/.venv`)
- **Docker Version:** 29.8.0, build 88096ef
- **Current Git Branch:** `master`
- **Last Commit:** `45d0c4c` (*feat(phase-12): venue operations, GLB onboarding pipeline, staff scanning PWA, KDS, loyalty, and ticket transfer*)
- **Git Tree State:** Working tree has uncommitted line-ending normalizations (CRLF/LF) and test screenshots from earlier test runs.
- **Service Health Probes:**
  - `GET http://127.0.0.1:8000/health` $\to$ `200 OK` (`status: ok, service: CineVerse API, version: 1.0.0`)
  - `GET http://127.0.0.1:8000/ready` $\to$ `200 OK` (`status: ready, db: connected, redis: connected`)
- **Asset Integrity Verification:**
  - `cineverse_auditorium_v2.glb`: Size: `9,562,712 bytes`, SHA256: `018e5705fec4d87f283d42455c197729bb9f0f46624b5dc8c5a42c1c95dbf15d` (**Untouched & Verified**).
  - `seat_layout_v2.json`: Exactly 100 seats. Row A seat 01 is audience left ($X = -6.0$), seat 10 is audience right ($X = +6.0$). A05 is mapped to `seat_A_05`.
  - `walk_nav_v2.json`: 21 walkable meshes, 122 colliders, spawn point `[0.0, 0.0, -5.5]`.
- **Database Migrations & Seeding:**
  - Alembic `upgrade head` from empty DB: **PASS** (Revisions `e9d50b3feda9` $\to$ `0f41eaaa443b`).
  - Alembic `downgrade -1`: **PASS** (Reverted to `e9d50b3feda9`).
  - Idempotent Seeding: Running `seed_database()` twice maintains constant table counts (7 cities, $\ge$ 4 cinemas, $\ge$ 12 movies).

---

## 3. Test Suites Execution Summary

| Test Suite | Command | Total | Passed | Failed | Duration | Verbatim Failure Summary |
|---|---|:---:|:---:|:---:|:---:|---|
| **Backend Pytest** | `pytest backend/tests/ -v` | 46 | 42 | 4 | 5.60s | `test_showtimes_and_seats_inventory` (0 > 0 showtimes)<br>`test_seat_hold_concurrency_race_condition` (IndexError)<br>`test_full_booking_payment_and_qr_ticket_lifecycle` (IndexError)<br>`test_ticket_transfer_flow_and_security_limits` (429 Rate Limit) |
| **Frontend Unit (Vitest)** | `npx vitest run` | 20 | 20 | 0 | 0.61s | Clean pass across `seatView`, `walkCollision`, and `glbIntegrity`. |
| **TypeScript Typecheck** | `npx tsc --noEmit` | - | - | 2 errors | 7.0s | `e2e/phase4_booking_engine.spec.ts:210,212`: `GPUCanvasContext` incompatible with `CanvasRenderingContext2D`. |
| **Frontend Lint** | `npm run lint` | - | 0 errors | 41 warnings | 5.0s | Clean pass (only unused imports & missing hook deps). |
| **Playwright Phase 4** | `npx playwright test e2e/phase4_booking_engine.spec.ts` | 8 | 8 | 0 | 29.6s | Clean pass: 2D map, 3D bridge, bidirectional sync, best available, WS hold. |
| **Playwright Phase 9** | `npx playwright test e2e/phase9_voice_agent.spec.ts` | 6 | 6 | 0 | 33.8s | Clean pass: Alt+V, multilingual, POV, payment ban, confirmation tap, injection defense. |
| **Playwright Phase 12** | `npx playwright test e2e/phase12_operations.spec.ts` | 4 | 4 | 0 | 11.2s | Clean pass: Mobile scanner PWA, admin onboarding, zero-PII KDS, loyalty profile. |
| **Playwright Phase 3** | `npx playwright test e2e/phase3_browse_journey.spec.ts` | 8 | 4 | 1 fail (3 skipped) | 56.4s | Test 05 timed out waiting for `showtime-chip` on Today (Showtime 1 mutated). |
| **Playwright Auditorium** | `npx playwright test e2e/auditorium.spec.ts` | 11 | 0 | 1 fail (10 skipped) | 8.7s | Test 01 failed: `Failed to load resource: net::ERR_FAILED` treated as fatal console error. |
| **Playwright Full Flow** | `npx playwright test e2e/website_full_flow.spec.ts` | 8 | 0 | 1 fail (7 skipped) | 60.0s | Test 01 timed out: City Selector modal backdrop intercepts clicks on navbar button. |
| **Concurrency Load Test** | `python tests/load_test_concurrency.py` | 150 | 140 | 0 | 0.91s | Hold Storm (50 clients): Exactly 1 winner, 49 rejected. Webhook burst: 50 clients, 49 succeeded. |

---

## 4. Traceability Matrix (Phases 1 to 12)

| Phase | Requirement / Task | Code Location | Test Name | Evidence File | Verified | Status |
|---|---|---|---|---|:---:|:---:|
| **1** | Database schema, async engine & migrations | `backend/app/database.py:11`<br>`backend/app/models/` | `test_seeding_twice_idempotent` | `pytest_audit_output.txt` | Y | **DONE** |
| **1** | Idempotent seeder with 100 3D seats | `backend/app/seed/seeder.py:423` | `test_100_seats_match_json_ids` | `pytest_audit_output.txt` | Y | **DONE** |
| **1** | `/health` and `/ready` probes | `backend/app/main.py:122-160` | `test_health_and_readiness` | `pytest_audit_output.txt` | Y | **DONE** |
| **2** | 3D scene, coordinate parity & lights | `frontend/components/3d/AuditoriumScene.tsx` | `lib/glbIntegrity.test.ts` | `vitest_audit_output.txt` | Y | **DONE** |
| **2** | First-person Walk mode with AABB collision | `frontend/components/3d/WalkController.tsx` | `lib/walkCollision.test.ts` | `vitest_audit_output.txt` | Y | **DONE** |
| **2** | Seated POV sightlines (A05, E05, J10) | `frontend/components/3d/CameraController.tsx` | `lib/seatView.test.ts` | `vitest_audit_output.txt` | Y | **DONE** |
| **2** | Video trailer playback on 3D screen mesh | `frontend/components/3d/Screen.tsx` | `e2e/auditorium.spec.ts:259` | `auditorium.spec.ts` | N | **PARTIAL** |
| **3** | Cities, movies, cinemas catalog & showtimes | `backend/app/api/v1/movies.py:153` | `test_movies_filters_and_sorting` | `pytest_audit_output.txt` | Y | **DONE** |
| **3** | URL-synced filters & global search API | `backend/app/api/v1/search.py` | `test_global_search_api` | `pytest_audit_output.txt` | Y | **DONE** |
| **3** | 7-day showtime grid & 2D screen fallback | `frontend/app/movies/[id]/page.tsx` | `e2e/phase3_browse_journey.spec.ts` | `phase3_browse_journey.spec.ts` | N | **BROKEN** |
| **4** | Concurrency seat hold race condition | `backend/app/services/hold_service.py` | `test_50_parallel_concurrency_race` | `pytest_audit_output.txt` | Y | **DONE** |
| **4** | Redis TTL & background sweeper task | `backend/app/services/sweeper.py` | `test_hold_expiry_and_late_confirmation` | `pytest_audit_output.txt` | Y | **DONE** |
| **4** | Real-time WebSocket hold broadcast | `backend/app/api/websockets/showtimes.py` | `e2e/phase4_booking_engine.spec.ts:233` | `phase4_booking_engine.spec.ts` | Y | **DONE** |
| **4** | Default 2D seat map & bidirectional 3D sync | `frontend/components/seatmap/SeatMap2D.tsx` | `e2e/phase4_booking_engine.spec.ts:75` | `phase4_booking_engine.spec.ts` | Y | **DONE** |
| **4** | 5-minute checkout countdown & extend once | `frontend/components/booking/HoldTimer.tsx` | `test_hold_extend_once_limit` | `pytest_audit_output.txt` | Y | **DONE** |
| **5** | Server-computed Razorpay order creation | `backend/app/services/payment_service.py:36` | `test_razorpay_order_creation_server_computed_amount` | `pytest_audit_output.txt` | Y | **DONE** |
| **5** | Constant-time HMAC-SHA256 signature verify | `backend/app/services/payment_service.py:22` | `test_razorpay_signature_validation_constant_time` | `pytest_audit_output.txt` | Y | **DONE** |
| **5** | Webhook idempotency & duplicate rejection | `backend/app/services/payment_service.py:165` | `test_payment_webhook_idempotency` | `pytest_audit_output.txt` | Y | **DONE** |
| **5** | Signed HMAC admission QR code pass | `backend/app/services/ticket_service.py` | `test_signed_qr_ticket_roundtrip_verification` | `pytest_audit_output.txt` | Y | **DONE** |
| **5** | Frontend payment gateway integration | `frontend/app/checkout/page.tsx:235` | `none` | `none` | Y | **STUBBED** |
| **6** | Customer account registration, login & JWT | `backend/app/services/auth_service.py` | `test_auth_registration_and_login_lifecycle` | `pytest_audit_output.txt` | Y | **DONE** |
| **6** | Patron booking history & cancellation refund | `frontend/app/profile/page.tsx` | `test_cancellation_and_refund_policy` | `pytest_audit_output.txt` | Y | **DONE** |
| **7** | Admin executive dashboard & analytics | `frontend/app/admin/page.tsx` | `test_admin_rbac_protection` | `pytest_audit_output.txt` | Y | **DONE** |
| **7** | Showtime scheduling conflict prevention | `backend/app/api/v1/showtimes.py` | `test_showtime_conflict_detection` | `test_phase7_admin.py` | Y | **DONE** |
| **8** | Concurrency benchmark & rate limits | `tests/load_test_concurrency.py` | `test_hold_storm` | `load_test_concurrency.py` | Y | **DONE** |
| **8** | Security headers (CSP, HSTS, X-Frame) | `frontend/next.config.mjs` | `manual` | `next.config.mjs` | Y | **DONE** |
| **8** | Docker compose, multi-stage build, Nginx | `docker-compose.yml`, `nginx/nginx.conf` | `manual` | `docker-compose.yml` | Y | **DONE** |
| **9** | Floating mic button & global `Alt+V` | `frontend/components/agent/` | `e2e/phase9_voice_agent.spec.ts:28` | `01_voice_agent_opened.png` | Y | **DONE** |
| **9** | Multilingual assistant (EN, HI, KN) | `backend/app/agent/prompts.py` | `e2e/phase9_voice_agent.spec.ts:51` | `02_multilingual_hindi_kannada.png` | Y | **DONE** |
| **9** | 3D POV & seat comparison voice tools | `backend/app/agent/tools.py` | `e2e/phase9_voice_agent.spec.ts:77` | `03_3d_voice_pov_view.png` | Y | **DONE** |
| **9** | 60-utterance tool calling evaluation suite | `backend/tests/test_phase9_voice_agent.py` | `test_tool_calling_eval_set_60_utterances` | `pytest_phase9_output.txt` | Y | **DONE** |
| **9** | Voice safety gate 1: Voice payment banned | `backend/app/agent/safety.py:38` | `test_safety_rule_1_voice_payment_banned` | `04_safety_payment_banned.png` | Y | **DONE** |
| **9** | Voice safety gate 2: Mandatory user tap cards | `frontend/components/agent/ConfirmationCard.tsx` | `test_safety_rule_2_state_mutations` | `05_confirmation_card_tap_required.png` | Y | **DONE** |
| **9** | Voice safety gate 3: Role-based tool access | `backend/app/agent/safety.py:115` | `test_safety_rule_3_guest_cannot_mutate_state` | `pytest_audit_output.txt` | Y | **DONE** |
| **9** | Voice safety gate 4: Prompt injection filter | `backend/app/agent/safety.py:20` | `test_safety_rule_4_prompt_injection_defense` | `06_prompt_injection_neutralized.png` | Y | **DONE** |
| **10** | Group booking sessions & invite tokens | `none` | `none` | `none` | N | **NOT STARTED** |
| **10** | Live seat selection & split payments | `none` | `none` | `none` | N | **NOT STARTED** |
| **11** | Best seat scoring engine (frontend/backend) | `none` | `none` | `none` | N | **NOT STARTED** |
| **11** | Comfort heatmap & dynamic pricing | `none` | `none` | `none` | N | **NOT STARTED** |
| **12** | Auditorium onboarding tool & GLB parser | `backend/app/services/onboarding_service.py` | `test_onboarding_pipeline_with_supplied_glb` | `02_admin_onboarding_dashboard.png` | Y | **DONE** |
| **12** | Coordinate space detection (Blender vs glTF) | `backend/app/services/onboarding_service.py:118` | `test_onboarding_pipeline_with_supplied_glb` | `02_admin_onboarding_dashboard.png` | Y | **DONE** |
| **12** | Asset versioning & atomic rollback | `backend/app/api/v1/operations/onboarding.py:148` | `test_asset_versioning_and_rollback` | `pytest_audit_output.txt` | Y | **DONE** |
| **12** | Turnstile entry scanning mobile PWA (390×844) | `frontend/app/staff/scan/page.tsx` | `test_staff_device_registration_and_entry_scanning` | `01_staff_scan_mobile.png` | Y | **DONE** |
| **12** | Single-use QR pass HMAC check & duplicate 409 | `backend/app/api/v1/operations/scanning.py:58` | `test_staff_device_registration_and_entry_scanning` | `pytest_audit_output.txt` | Y | **DONE** |
| **12** | At-seat food ordering & zero-PII KDS | `frontend/app/staff/kds/page.tsx` | `test_at_seat_food_pre_order_and_kds_lifecycle` | `03_staff_kds_screen.png` | Y | **DONE** |
| **12** | Loyalty points ledger & CinePass subscription | `frontend/app/profile/page.tsx` | `test_loyalty_points_ledger_and_cinepass_entitlement` | `04_loyalty_cinepass_profile.png` | Y | **DONE** |
| **12** | Ticket transfer cutoff (2h) & rate limit | `backend/app/api/v1/operations/transfer.py:46` | `test_ticket_transfer_flow_and_security_limits` | `pytest_audit_output.txt` | Y | **DONE** |

---

## 5. False Completion Findings & Vulnerabilities

### Finding 1: Frontend Checkout is a Stub with Hardcoded Backend Bypass
- **Severity:** **CRITICAL**
- **Location:** `frontend/app/checkout/page.tsx:112-117`, `frontend/app/checkout/page.tsx:235-262`, `backend/app/services/payment_service.py:24-25`
- **Description:** While Phase 5 was claimed as passed, the frontend checkout page does not launch the actual Razorpay checkout modal (`Razorpay({...}).open()`). Instead, lines 112-117 send `razorpay_signature: 'test_signature_valid'`. The backend `payment_service.py` contains an explicit bypass:
  ```python
  if signature in ("test_signature_valid", "simulated_success_signature"):
      return True
  ```
  The UI visibly displays: `[Phase 4 Stub] Payment Gateway Preview` and `Complete Checkout (Phase 4 Stub) • ₹{grandTotal}`.
- **Remediation:** Remove the hardcoded signature bypass in production mode. Mount the real Razorpay script on checkout or integrate standard Razorpay checkout handler for sandbox/production.

### Finding 2: Shared Test Database Mutation & Order-Dependent Test Breakage
- **Severity:** **HIGH**
- **Location:** `backend/tests/test_phase12_operations.py:353`, `backend/tests/test_phase12_operations.py:497`, `backend/tests/test_api_and_concurrency.py:54`
- **Description:** Running pytest mutates the active SQLite database file. In `test_phase12_operations.py`, `Showtime 1`'s `start_time` is set to `datetime.utcnow() + timedelta(days=2)`. When `test_api_and_concurrency.py` or Playwright `phase3_browse_journey.spec.ts` runs afterwards, querying `GET /api/v1/movies/1/showtimes` for "Today" returns empty, breaking 3 pytest tests and 1 Playwright test. Similarly, user 3's monthly transfer quota (5 transfers/month) is exhausted after repeated test runs, causing `test_ticket_transfer_flow_and_security_limits` to fail with `429 Too Many Requests`.
- **Remediation:** Wrap tests in rollback transactions or use an in-memory/isolated SQLite file (`sqlite+aiosqlite:///:memory:`) for pytest sessions.

### Finding 3: TypeScript Compilation Errors in `frontend` (`tsc --noEmit`)
- **Severity:** **MEDIUM**
- **Location:** `frontend/e2e/phase4_booking_engine.spec.ts:210,212`
- **Description:** Running `npx tsc --noEmit` fails with 2 errors:
  ```
  e2e/phase4_booking_engine.spec.ts(210,7): error TS2322: Type '(type: string, ...args: any[]) => GPUCanvasContext | null' is not assignable to type ...
  e2e/phase4_booking_engine.spec.ts(212,43): error TS2345: Argument of type '[any, ...any[]]' is not assignable to parameter of type '[contextId: "webgpu"]'.
  ```
- **Remediation:** Cast the canvas prototype override in the test script: `HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]): any { ... }`.

### Finding 4: Playwright Test Flakiness (Console Error Trapping & Modal Backdrop)
- **Severity:** **MEDIUM**
- **Location:** `frontend/e2e/auditorium.spec.ts:43`, `frontend/e2e/website_full_flow.spec.ts:39`
- **Description:**
  - In `auditorium.spec.ts`, non-fatal browser resource load failures (`net::ERR_FAILED`) trigger `expect(fatalErrors).toHaveLength(0)` assertion failure on test 01, skipping all remaining 10 tests.
  - In `website_full_flow.spec.ts`, opening the homepage without `cineverse_city` in localStorage opens the City Selection Modal, whose backdrop intercepts pointer events when clicking the navbar city selector, leading to a 60s timeout.
- **Remediation:** In `auditorium.spec.ts`, filter out `net::ERR_FAILED` from fatal page errors. In `website_full_flow.spec.ts`, initialize `cineverse_city` in localStorage via `addInitScript`.

---

## 6. Discrepancies Between Documentation and Reality

| Item | Claim in Status / Reports | Reality Discovered |
|---|---|---|
| **Phase 5 Frontend** | Claimed `PASS` with end-to-end Razorpay checkout | Frontend checkout UI is visibly labelled `Phase 4 Stub` with hardcoded bypass token |
| **Phase 10 & 11** | Status reports show Phase 12 done; phases 10-11 omitted | Phases 10 and 11 were skipped completely; not started |
| **Backend Test Suite** | Reported 46/46 tests passed | 4 tests fail on second run due to database state contamination and transfer rate limits |
| **`tsc --noEmit`** | Assumed clean build | Fails with 2 errors in `phase4_booking_engine.spec.ts` |
| **E2E Playwright** | Claimed 11/11 auditorium tests pass | `auditorium.spec.ts` fails on test 01 due to console error trap; 10 tests skipped |

---

## 7. Prioritised Fix List

| ID | Severity | Description | Location | Suggested Fix | Effort |
|---|:---:|---|---|---|:---:|
| **FIX-01** | **CRITICAL** | Eliminate Phase 4 stub in checkout & integrate real Razorpay handler | `frontend/app/checkout/page.tsx`<br>`backend/app/services/payment_service.py` | Load `checkout.js`, remove hardcoded `test_signature_valid` and Phase 4 stub labels | M |
| **FIX-02** | **HIGH** | Fix test database pollution and rate limit isolation | `backend/tests/conftest.py`<br>`test_phase12_operations.py` | Use isolated test DB or rollback fixtures; reset transfer logs in transfer test | S |
| **FIX-03** | **MEDIUM** | Resolve TypeScript typecheck errors in `tsc --noEmit` | `frontend/e2e/phase4_booking_engine.spec.ts` | Typecast canvas prototype override to `any` | S |
| **FIX-04** | **MEDIUM** | Fix Playwright modal intercept & console error traps | `frontend/e2e/auditorium.spec.ts`<br>`e2e/website_full_flow.spec.ts` | Ignore `net::ERR_FAILED` in console filter; seed localStorage with city in full flow | S |
| **FIX-05** | **LOW** | Clean up unused ESLint variables in frontend components | Multiple frontend files | Remove 41 unused imports and add missing hook dependencies | S |

---

## 8. Final Recommendation

### **Recommendation: `FIX FIRST`**

All Critical and High findings (**FIX-01** and **FIX-02**) must be resolved before proceeding to Phase 10 or 11. Specifically:
1. Complete the real Phase 5 frontend Razorpay payment integration in `frontend/app/checkout/page.tsx` and eliminate the backend signature bypass.
2. Isolate test database mutations so all 46 backend pytest tests and all Playwright suites pass deterministically in any run order.
3. Fix the 2 TypeScript errors so `tsc --noEmit` succeeds cleanly.

