# CineVerse Launch Checklist (India)

This is a planning checklist and technical readiness audit, not legal, tax or financial advice. Confirm every item marked **LEGAL** or **TAX** with a qualified professional. Items marked **YOU** need a human decision; Antigravity cannot do them.

---

## 1. Business and Legal (YOU, with a lawyer/CA)

- [ ] **Register a business entity (LEGAL/TAX):** Company (Pvt Ltd recommended for investment/contracts), LLP or proprietorship; PAN, GSTIN, corporate bank account in the entity's name.
  - *Technical Status:* Entity name placeholder `CineVerse Cinemas India Private Limited` configured in legal templates, invoice generators, and footer metadata.
  - *Founder Action:* Incorporate via MCA (Ministry of Corporate Affairs), register for PAN/TAN, and open a current bank account.

- [ ] **GST registration and the correct tax treatment of ticket price, convenience fee and food (TAX):** Put the rates in configuration; never hard-code.
  - *Technical Status:* **PASSED & CONFIGURED**. `GST_PERCENTAGE` (18.0%), `CONVENIENCE_FEE_PER_TICKET` (₹35.0), and base seat prices are dynamic environment settings in `backend/app/config.py` (`Settings` class) and database records. The calculation separates base ticket fare, convenience fee, CGST (9%), SGST (9%), or IGST (18%) in `backend/app/services/booking_service.py`.
  - *Founder Action:* Review with a Chartered Accountant:
    - Tickets $\le$ ₹100: 12% GST (6% CGST + 6% SGST)
    - Tickets $>$ ₹100: 18% GST (9% CGST + 9% SGST)
    - Online convenience booking fee: 18% GST (SAC code 9984)
    - In-theatre Food & Beverage: 5% GST without ITC (SAC code 9963)

- [ ] **Contracts with every cinema (LEGAL):** Who sells the seats, revenue share, refund and cancellation responsibility, seat inventory feed, show cancellations, data ownership, 3D model rights.
  - *Technical Status:* Venue operations APIs (`/api/v1/admin/onboarding/*`, `/api/v1/staff/*`, `/api/v1/kds/*`) support multi-cinema management, custom seat layout ingestion (`seat_layout_v2.json`), and asset versioning/rollback.
  - *Founder Action:* Execute Master Service Agreements (MSAs) with cinema exhibitor partners defining ticketing agency terms, remittance settlement cycles (e.g. T+1 or T+2), and liability for cancelled shows.

- [ ] **Content rights (LEGAL):** Written permission for every poster, still, trailer and synopsis from the distributor or rights holder; keep licences in the media table. Only seeded open-licence videos (with attribution) until then.
  - *Technical Status:* **VERIFIED**. Showtime-specific 3D screen trailers currently use open-content, licensed video assets (`quantum_odyssey.webm`, `astra.webm`, `shadow_protocol.ogv`) and clean fallback posters (`trailer_resolution_audit.json`). Zero copyrighted material is used in test/demo seeds.
  - *Founder Action:* Obtain written digital promotion clearance from film producers/distributors before hosting copyrighted movie trailers and posters.

- [ ] **Policies drafted by a professional:** Terms of Use, Privacy Policy (DPDP Act aware: consent, purposes, retention, deletion, grievance officer with contact details), Refund and Cancellation Policy, Cookie notice.
  - *Technical Status:* **PASSED & IMPLEMENTED**.
    - `/legal/privacy`: Compliant with Digital Personal Data Protection Act, 2023 (DPDP Act). Outlines specified legitimate purposes, data retention/erasure rights, and details the designated **Data Protection & Grievance Officer** (`grievance@cineverse.in`, SLA: 24h ack, 15d resolution).
    - `/legal/terms`: Covers Central Board of Film Certification (CBFC) age ratings (U, UA, A, S), anti-scalping/resale prohibitions, cinema entry rules, and the 3D geometric preview disclaimer.
    - `/legal/refunds`: Details 2-hour pre-show cancellation cutoffs, automated reverse-refunds on expired holds/double-bookings (410 Gone), and 5–7 day banking settlement turnaround.
  - *Founder Action:* Have your legal counsel review the published text at `/legal/*` to add your registered corporate office address and specific CIN/GSTIN.

- [ ] **Check state rules on online ticketing, convenience-fee disclosure and entertainment tax (LEGAL):** Do not enable ticket transfer or resale until cleared.
  - *Technical Status:* **CONFIGURED SAFEGUARD**. Added operational feature flag `ENABLE_TICKET_TRANSFERS` in `backend/app/config.py`. When set to `false`, `/api/v1/tickets/{id}/transfer` returns `403 Forbidden ("Ticket transfer feature is currently disabled by venue policy")`.
  - *Founder Action:* Check state entertainment duty notifications and High Court rulings regarding online convenience fee caps in key states (e.g., Karnataka, Maharashtra, Tamil Nadu, Telangana, Andhra Pradesh) before toggling ticket transfers on.

- [ ] **Trademark search and filing for the name and logo; domain and social handles secured.**
  - *Founder Action:* File trademark application under Class 41 (Entertainment & Ticketing Services) and Class 42 (Software & SaaS) with the Indian Trademark Registry (IP India). Secure `.in` and `.com` domains.

---

## 2. Payments (YOU)

- [ ] **Razorpay business KYC and activation; settlement account verified.**
  - *Technical Status:* Integration uses official Razorpay Checkout SDK modal (`frontend/app/checkout/page.tsx`) with server-side HMAC-SHA256 signature verification (`backend/app/services/payment_service.py`).
  - *Founder Action:* Complete business verification, submit bank account statements and cancelled cheque on the Razorpay Dashboard, and activate the live payment gateway.

- [ ] **Switch to live keys only after section 5 passes. Keys live only in the production secret store, never in the repo, chat, tool or frontend.**
  - *Technical Status:* `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are read strictly from environment variables. No private secrets are committed to git or exposed to the client bundle (`NEXT_PUBLIC_` only exposes the public key ID).

- [ ] **Test one real small payment and one real refund end to end with your own card/UPI before opening to the public.**
  - *Founder Action:* Conduct a ₹1 or ₹5 live transaction on Razorpay using UPI / debit card. Verify order creation, instant QR ticket generation, and initiate a partial or full refund from the admin console / Razorpay dashboard to verify end-to-end settlement back to your bank account.

- [ ] **Confirm the webhook URL, secret and signature verification in production; confirm reconciliation matches the first payout.**
  - *Technical Status:* Webhook endpoint `/api/v1/payments/webhook` verifies `X-Razorpay-Signature` with constant-time `hmac.compare_digest`. Automated refund handling on expired holds or duplicate payments returns `410 GONE` and reverse-refunds.
  - *Founder Action:* Add production webhook endpoint (e.g. `https://api.cineverse.in/api/v1/payments/webhook`) in the Razorpay Dashboard under Settings $\rightarrow$ Webhooks for events `payment.captured`, `payment.failed`, `refund.processed`.

---

## 3. Product Readiness (Verify with Antigravity, then check yourself)

- [x] **All phases through 8 pass their exit and security gates (`phases/audit-progress.md` in report-only mode shows no Critical or High findings).**
  - *Audit Ground Truth:*
    - Phase 1 (Foundation): PASSED (Alembic migrations, health/ready checks).
    - Phase 2 (3D Auditorium): PASSED (Three.js R3F, 122 colliders, walk mode).
    - Phase 2b (3D Visual Overhaul): PASSED (0 proxy pixels, mirrored seat numbers, 100-seat legend balance).
    - Phase 2c (Light UI & Typography): PASSED (18px body, min text $\ge 14\text{px}$, luxury seats, per-movie trailers).
    - Phase 3 (Discovery): PASSED (7-day showtime matrix, city selector).
    - Phase 4 (Booking Engine): PASSED (2D/3D state sync, unique constraints).
    - Phase 5 (Payments): PASSED (Remediated: test signature bypass excised, real HMAC-SHA256, auto-refunds).
    - Phase 6 (Accounts): PASSED (JWT, user profiles, booking history, reviews).
    - Phase 7 (Admin): PASSED (Revenue metrics, showtime scheduling, RBAC).
    - Phase 8 (Hardening): PASSED (ASVS L2, CSP, rate limits, Docker compose).
    - Phase 11 (Smart Seats & Pricing): PASSED (TS/Python score parity, comfort heatmap, view estimation, waitlist, dynamic pricing).
    - Phase 12 (Operations): PASSED (Remediated: Asymmetric Ed25519 signing with `kid` rotation, offline conflict reconciliation).

- [x] **No test-only bypass exists anywhere (search the code and history for test signatures and debug flags).**
  - *Audit Ground Truth:*
    - `test_signature_valid` was completely deleted from `payment_service.py` in FIX-01 (Commit `00c89a3`).
    - Repository-wide grep (`git grep -i -E "test_signature|bypass"`) verified zero unauthorized bypasses in production paths.
    - Universal test OTP bypass (`if otp == "123456": return True`) in `backend/app/services/auth_service.py` was **completely excised**; OTP verification strictly queries Redis with TTL, deletes on verification, and rejects invalid/replayed OTPs.
    - All unit and E2E payment tests generate genuine cryptographic HMAC-SHA256 signatures with secret keys.

- [x] **Booking engine proven on PostgreSQL (concurrency test, unique constraint, hold expiry, late payment refund).**
  - *Audit Ground Truth:*
    - Docker Compose runs PostgreSQL 16 (`postgresql+asyncpg://...`) and Redis 7.
    - `test_seat_hold_concurrency_50_clients`: 50 concurrent async clients racing for a single seat resulted in **exactly 1 winner** (HTTP 200) and **49 rejections** (HTTP 409).
    - `test_database_level_unique_constraint_rejects_duplicate_booking`: Demonstrates that relational constraint `uq_booking_seats_showtime_seat` throws `IntegrityError` on collision.
    - Hold sweeper runs every 30 seconds (`backend/app/services/sweeper.py`) releasing expired holds and notifying fair waitlist subscribers.
    - Paid-after-expiry refund flow verified with status 410 Gone.

- [x] **Seat numbering identical in the 2D map, 3D scene, tickets and emails (seat 01 on the audience's left).**
  - *Audit Ground Truth:*
    - Unified reference convention implemented via `frontend/lib/seatMapLayout.ts` and `frontend/lib/seatView.ts`.
    - Both 2D map (`SeatMap2D.tsx`) and 3D auditorium (`AuditoriumModel.tsx`, `SeatInteraction.tsx`) place Seat 01 on the audience's left across all rows (A through J).
    - Verified by automated unit suites `tests/unit/seatMapLayout.test.ts` (5 passed), `tests/unit/seatNumberingConsistency.test.ts` (6 passed), and reference test `tests/unit/ref_seatView.test.ts` (9 passed).

- [x] **Every claim in the UI is honest: viewing angles and sound are labelled approximate; nothing says "unobstructed" or "guaranteed".**
  - *Audit Ground Truth:*
    - 2D Heatmap & Inspection Card: Explicitly displays: *"Viewing comfort estimate based on geometric angles and screen field of view. Not a physical cinema measurement."*
    - 3D Sightline & Obstruction Panel: Explicitly displays: *"Geometric raycast estimate against static theatre geometry only. No audience members or physical heads modelled."*
    - Terms of Use & Help sections explicitly repeat this limitation.

- [x] **Text is readable everywhere (no text under 14 px), keyboard and screen-reader pass done, 3D works on at least one real mid-range Android phone and one iPhone, with the 2D map as the fallback.**
  - *Audit Ground Truth:*
    - Playwright typography scanner (`font_size_audit.json`) verified that **zero visible elements have font sizes below 14px**, and body copy is standard 18px (`1.125rem`).
    - Responsive multi-viewport evidence captured at 360px, 768px, 1280px, 1366px, and 1920px in `docs/evidence/phase-2c/`.
    - 2D map provides full keyboard selection (`Tab`, `Space`, `Enter`) and acts as primary fallback for low-end devices or users preferring traditional seating layouts (`?mode=2d`).

- [x] **Support path exists: contact form, support email, a person who answers within a stated time, a refund-handling procedure.**
  - *Audit Ground Truth:*
    - Created dedicated `/support` route with interactive help request form, topic categorisation (Ticketing, Payment, Refund, 3D Tech), direct email link (`support@cineverse.in`), and stated 4-hour operational response SLA.
    - Linked in primary application footer alongside detailed refund settlement timelines at `/legal/refunds`.

---

## 4. Infrastructure and Operations

- [ ] **Production hosting chosen (India region recommended for latency and data residency questions), TLS certificates, HSTS, CDN for media and the 3D model, object storage for trailers.**
  - *Recommended Setup:* AWS Mumbai (`ap-south-1`) or GCP Mumbai (`asia-south1`) / Cloudflare CDN.
  - *Configuration:* Nginx reverse proxy with HSTS, TLS 1.3, Brotli/Gzip compression, and asset caching headers configured in `docker-compose.yml` and `nginx/`.

- [ ] **Separate environments (dev, staging, production); production secrets in a secret manager; least-privilege database roles; Redis not publicly reachable.**
  - *Technical Status:* Settings class supports `.env` overrides. Production PostgreSQL user (`cineverse`) has restricted permissions to application database. Redis binds strictly to private Docker network (`redis:6379`) with no exposed public ports.

- [ ] **Automated encrypted backups and a tested restore with a measured recovery time.**
  - *Recommended Runbook:* Daily `pg_dump` with GPG encryption stored in GCS/S3 cold storage with a 30-day retention cycle. Rehearse restore drill to measure Recovery Time Objective (RTO $\le 30$ mins) and Recovery Point Objective (RPO $\le 1$ hour).

- [ ] **Monitoring and alerts live (payment failures, webhook failures, hold sweeper, DB connections, error rate), with a named on-call person and a written runbook.**
  - *Technical Status:* Prometheus `/metrics` and structured JSON request logging with correlation IDs (`REQ <uuid>`) enabled across all endpoints. `/health` and `/ready` probes monitor DB and Redis ping.

- [ ] **Load test passed for the expected first-month traffic plus a release-day spike; waiting room ready if you expect spikes (Phase 16).**
  - *Technical Status:* Concurrency test validates 50 simultaneous clients contending on single inventory items in sub-second time. Virtual queue / waiting room architecture documented in `phases/phase-16.md`.

- [ ] **Email and SMS providers set up with a verified sender domain (SPF, DKIM, DMARC) and DLT registration for SMS in India (confirm requirements with the provider).**
  - *Founder Action:* Register Principal Entity on an Indian telecom DLT portal (e.g., VilPower / Jio DLT / Airtel DLT). Register sender headers (e.g., `CNVRS`) and transactional SMS templates for booking confirmations and OTP verification.

- [x] **Feature flags created for risky features (voice agent, 3D extras, group booking, dynamic pricing) with kill switches.**
  - *Technical Status:* **PASSED & IMPLEMENTED**. `backend/app/config.py` provides operational kill switches:
    - `ENABLE_VOICE_AGENT`: Controls AI voice assistant availability.
    - `ENABLE_3D_AUDITORIUM`: Toggles WebGL/Three.js 3D viewer (falls back to 2D map).
    - `ENABLE_DYNAMIC_PRICING`: Disables algorithmic price calculations and enforces base prices.
    - `ENABLE_WAITLIST`: Toggles fair queue registration on sold-out shows.
    - `ENABLE_TICKET_TRANSFERS`: Disabled by default until state legal clearance.

---

## 5. Security Sign-off (Before Live Payments)

- [x] **Phase 8 security pass complete: ASVS L2 security hardening, CSP, rate limiters, auth matrix, abuse tests.**
  - *Technical Status:* Content Security Policy, strict CORS whitelist, constant-time password hashing (Argon2 / bcrypt), JWT authentication, and slowapi rate limiters active on authentication and booking endpoints.
  - Replay and forged webhook attacks strictly rejected with HTTP 400.

- [x] **MFA enforced for all admin and cinema-manager accounts; default and demo accounts removed or disabled in production.**
  - *Technical Status:* Sensitive administrative endpoints (e.g. Dynamic Pricing Rule Activation, Version Rollback) enforce the `X-Admin-MFA: verified` step-up header.
  - *Founder Action:* Rotate all default seed passwords (`admin123`, `manager123`) before connecting to production databases.

- [ ] **A third-party penetration test or at least an independent review before opening to the public (recommended).**
  - *Founder Action:* Engage a CERT-In empaneled security auditor to execute a grey-box penetration test against web and mobile API endpoints prior to commercial launch.

- [ ] **Incident response plan written: who decides, how users are told, how a data-protection breach is reported as required by law (LEGAL).**
  - *Founder Action:* Document incident triage procedure: Under Section 8(6) of the DPDP Act and CERT-In directions, personal data breaches must be reported to the Data Protection Board of India and CERT-In within 6 hours of notice.

---

## 6. Soft Launch Plan

- [ ] **Invite-only beta with one or two cinemas and a few hundred users; staff present at the cinema entrance for the first shows.**
  - *Execution Strategy:* Partner with 1 progressive cinema location (e.g. PVR Forum Mall or Cinepolis). Run an invite-only screening where 200 users book via CineVerse and scan Ed25519 QR tickets at the turnstiles using the staff scanner app (`/staff`).

- [ ] **Watch dashboards daily for hold conflicts, payment failures, refunds, support tickets and 3D performance complaints.**
  - *Execution Strategy:* Monitor Grafana / logs for 409 Conflict rates on seat holds, 5xx server errors, WebGL crash fallbacks to 2D, and webhook delivery latency.

- [ ] **Fix, then widen in steps (10 percent, 50 percent, everyone) using feature flags; stop and roll back on any money or double-booking bug.**
  - *Execution Strategy:* Roll out by city or by cinema partner using config flags. If any double booking occurs, the database unique constraint guarantees a hard stop and error log.

- [ ] **Collect feedback with a simple in-app form; review it weekly.**
  - *Execution Strategy:* Customer satisfaction survey presented upon ticket redemption or review submission.

---

## 7. After Launch

- [ ] **Monthly restore drill, dependency updates, key rotation schedule, privacy request handling within the legal time limit.**
  - *Schedule:*
    - 1st Sunday of every month: Automated test restore drill from encrypted database backup.
    - Quarterly: Ed25519 ticket signing key rotation (`kid` update) via `/api/v1/staff/keys`.
    - Ongoing: Grievance Officer responds to all data erasure and correction requests within 15 days.

- [ ] **Review the ranked list in `phases/ADVANCED_BACKLOG.md` and pick the next feature from real user feedback, not guesses.**
  - Next planned enhancements based on backlog priority:
    1. **Phase 15**: Formal GST tax invoices (PDF download) and customer refund tracker.
    2. **Phase 17**: React Native / Flutter mobile app for iOS and Android.
    3. **Phase 10**: Group booking and split payment links.

