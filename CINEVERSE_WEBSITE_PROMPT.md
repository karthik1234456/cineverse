# CineVerse — Full Website Build Prompt (BookMyShow-class platform + 3D seat booking)

Act as a senior full-stack architect, product designer and QA lead. Build **CineVerse**, a complete, production-quality movie-ticket booking website comparable in scope to BookMyShow / PVR INOX / Paytm Insider, whose signature differentiator is **choosing seats inside a real 3D auditorium and previewing the view from each seat**.

Write and run real code. Do not mark anything done without evidence (tests, screenshots). Fix errors instead of bypassing them. Make reasonable decisions and document them in `docs/decisions.md` rather than stopping.

**Companion specs (authoritative):** `DESIGN_SPEC.md` (layouts, tokens, components, trailer player) and `SECURITY_SPEC.md` (security requirements and tests). Follow them in every phase.

Mobile app comes AFTER the website (see §12). Design the backend API-first so the app can reuse it unchanged.

## 0. Existing assets (use them; do not regenerate)
- `frontend/public/models/cineverse_auditorium_v2.glb` — procedural auditorium, 100 individual seat meshes `seat_A_01…seat_J_10`, ~1.5M triangles (seats are 99% of it; optimise a web copy, keep the original).
- `frontend/public/models/seat_layout_v2.json` — 100 seats generated from the GLB (IDs `A01…J10`, eye positions, distances, angles, categories).
- `tools/generate_seat_layout.py`.
- **`ANTIGRAVITY_PROMPT.md` is the authoritative spec for the 3D auditorium module** (coordinate rules: glTF Y-up, screen at z≈-1.25, seats face +Z, camera must `lookAt` the screen; honesty rules about estimated views; performance rules). Build that module exactly to that spec and embed it into the booking flow here. Do not duplicate or contradict it.

## 1. Stack (do not add unnecessary tech)
Frontend: Next.js (App Router), TypeScript, Tailwind, shadcn/ui, React Three Fiber/three/drei, Zustand (3D + booking UI state), TanStack Query, Framer Motion, React Hook Form + Zod. Backend: Python, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic. DB: PostgreSQL (source of truth). Redis: cache, seat-hold TTL coordination, rate limiting, WebSocket fan-out, job queue (RQ/Arq). Payments: Razorpay (test mode). Infra: Docker + docker-compose, `.env.example`, Nginx-ready. Monorepo `cineverse/{frontend,backend,docs,tools}`. Monolith — no microservices.

## 2. Product scope (BookMyShow parity first, then our differentiators)

### 2.1 Discovery & browsing
- **City selector** (modal on first visit, persisted; seed Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Pune, Kolkata). Everything (movies, cinemas, showtimes) is city-scoped. Optional geolocation suggestion.
- **Home**: cinematic hero carousel, "Now Showing", "Coming Soon", "Trending in <city>", "Recommended for you", "Top cinemas", language & format chips, offers banners, "Try 3D Seat Preview" showcase section. Skeleton loaders, no layout shift.
- **Search** (global, debounced, typo-tolerant using Postgres `pg_trgm`/full-text): movies, cinemas, cast. Recent searches, suggestions.
- **Movies listing** (`/movies`): filters — language, genre, format (2D/3D/IMAX/4DX/Dolby), certificate (U/UA/A), release status, date; sort by popularity/rating/release; pagination or infinite scroll; URL-synced filters.
- **Movie details**: banner, poster, **trailer via the reusable `TrailerPlayer`** (HLS/MP4 from our media pipeline with captions, quality selector, mini-player/PiP, resume; sandboxed privacy-friendly embed only as fallback; see `DESIGN_SPEC.md` §6), synopsis, genres, languages, formats, duration, certificate, release date, cast & crew with photos, user ratings + "I'm interested" votes, user reviews (with moderation + spoiler tag), similar movies, **showtimes grouped by cinema for selected date** (next 7 days) with format/language/price filters and "Fast filling / Almost full / Sold out" availability colours computed from real inventory.
- **Cinemas listing & cinema details**: address, map link, facilities (parking, F&B, wheelchair access, recliners, Dolby…), cancellation policy, screens with formats, date-wise showtimes, photos, "Enter 3D Theatre" per auditorium.
- **Showtime selection UX**: date strip, cinema-wise grid of time chips, tooltip with price range + availability, "Cancellation available" badge.

### 2.2 Booking flow (the core)
1. Choose showtime → **ticket-count modal** (1–10) with vehicle-style category cards and prices (like BMS), skip for 3D mode if the user prefers.
2. **Seat selection, STANDARD MAP FIRST (default).** A conventional, fast, accessible 2D seat map built from the real layout data (same seat IDs and live WebSocket state as the 3D scene; seat 01 on the audience's left), category bands with prices, quantity-aware selection, "Best available" suggestion, sticky summary, hold countdown, and a collapsible **trailer mini-player**. Layout exactly per `DESIGN_SPEC.md` §4.3. An **"Explore in 3D" button** opens the immersive theatre (per `ANTIGRAVITY_PROMPT.md`, including walk and seated first-person modes and the trailer on the cinema screen). Selection, holds and the countdown are shared two-way between the 2D map and 3D; closing 3D returns to the map. If a screen has no 3D asset or WebGL is unavailable, the 2D map is the whole experience and the button is replaced by an explanatory label.
3. **Add-ons**: F&B combos (popcorn/drink/combos) per cinema with quantity steppers, pickup at counter (optional step, can be skipped).
4. **Review & checkout**: movie, cinema, screen, showtime, seats, ticket price, convenience fee, GST (as configurable %), add-ons, **coupon/offer code** (validation with rules: min amount, per-user limit, expiry, bank/UPI offers as data), contact details (phone/email prefilled), T&C. Visible **hold countdown** (default 5 min, configurable) with clear expiry handling and "extend once".
5. **Payment** (Razorpay test mode): server-created order, client checkout, **server-side signature verification**, webhook with signature check + idempotency (duplicate/out-of-order events safe), failure/retry flow, payment-pending recovery (user closes tab → reconcile via webhook/poll), refund API wiring (test mode).
6. **Confirmation**: booking ID, **QR e-ticket** (signed payload), downloadable PDF + printable view + Add-to-Calendar (.ics) + share; confirmation email (dev: Mailpit/console), SMS/WhatsApp adapter interface (mock provider in dev).
7. **Post-booking**: cancellation per cinema policy with computed refund (rules table), reschedule not required v1, "Invite friends / split payment" optional later.

### 2.3 Booking-engine rules (non-negotiable)
Lifecycle `AVAILABLE → HELD → PAYMENT_PENDING → BOOKED`; failure/expiry returns to AVAILABLE. Per-showtime `seat_inventory` rows (same seat has independent state per showtime). PostgreSQL transactions + `SELECT … FOR UPDATE` (or `SKIP LOCKED` where appropriate) and a **unique constraint preventing two confirmed bookings for the same showtime+seat**. Expiring holds via `hold_expires_at` + background sweeper; an expired hold must never convert to a booking even if payment arrives late (→ auto-refund path + user notice). Idempotency keys on hold/pay endpoints. Redis is cache/coordination only. WebSocket channel per showtime broadcasting seat state diffs; clients reconcile with REST on reconnect. Max seats per booking configurable (default 8). Rate-limit holds per user/IP.

### 2.4 Accounts & profile
Register/login (email+password with Argon2/bcrypt, **OTP login via phone as a pluggable provider — mock in dev**), JWT access + rotating refresh (httpOnly cookies, CSRF protection), email verification, password reset, social login adapter (optional/stub-flagged). Profile: details, **bookings (upcoming/past/cancelled)** with ticket download, watchlist ("Interested"), saved preferences (city, languages, formats, preferred seat categories/rows), saved payment preferences (no raw card data ever), notifications centre, reviews written, loyalty/wallet balance (simple ledger, v1 can be points only), account deletion/export (privacy).

### 2.5 Offers, content & growth
Offers page + coupon engine, referral code (basic), **Gift cards** (stretch), curated lists, movie news/blog (simple CMS), FAQs/help center, contact/support ticket form, Terms/Privacy/Refund pages (India: DPDP-aware cookie/consent banner), SEO: SSR/ISR for movie/cinema pages, `sitemap.xml`, `robots.txt`, OpenGraph/Twitter cards, JSON-LD (`Movie`, `ScreeningEvent`, `MovieTheater`), canonical URLs, localisation-ready routing.

### 2.5b Internationalisation & accessibility
i18n scaffold (next-intl) with English + Hindi + Kannada string files; INR formatting; dates in IST. WCAG 2.2 AA: keyboard nav, focus states, contrast, ARIA, reduced motion, alt text, colour-blind-safe seat states.

### 2.6 Admin / partner portals (separate, role-protected: `admin`, `cinema_manager`, `support`, `customer`)
- Movies CRUD (posters, **trailer upload with transcoding status, captions, rights confirmation**, cast, certificates, languages, formats), cinemas, auditoriums, **seat-layout & 3D model upload** (validate GLB: node names, triangle budget, schema; map nodes→seats; preview in 3D), showtimes (bulk scheduling, conflict detection per screen), pricing rules (category × day/time × format, surge/weekend), coupons, F&B menu, bookings search/refund/cancel, users, reviews moderation, CMS, **analytics** (revenue, occupancy, top movies/cinemas, funnel from view→hold→pay, payment failure reasons), audit log of admin actions, CSV export.
- Cinema-manager role sees only their cinemas.

## 3. Data model (Alembic migrations + seed)
`users, roles, refresh_tokens, sessions, mfa_factors, movie_media (video/poster/caption assets, renditions, rights holder, licence, status), media_jobs, cities, movies, movie_people, movie_cast, languages, genres, movie_formats, cinemas, cinema_facilities, auditoriums, theatre_assets (GLB/layout, version, checksum), seats (stable IDs ↔ GLB node_name), showtimes, price_rules, seat_inventory, bookings, booking_seats, booking_addons, fnb_items, payments, payment_events (webhook idempotency), refunds, tickets, coupons, coupon_redemptions, reviews, watchlist, notifications, audit_logs`. Indexes for city+date+movie queries; constraints as per §2.3. **Seed**: 7 cities, ~8 cinemas, 1 real 3D auditorium (the supplied one, 100 seats, categories front/prime/premier — treat demo prices as placeholders), ≥ 12 movies (original/placeholder titles, local posters generated locally, no external API required; optional TMDB adapter behind an env flag), showtimes for the next 7 days, sample users/roles, coupons, F&B. Other cinemas without 3D assets must degrade gracefully (2D seat-list mode + "3D coming soon").

## 4. API (REST + WebSocket, OpenAPI docs)
Group under `/api/v1`: auth, users, cities, movies, cinemas, auditoriums (`/layout`, `/assets`), showtimes (`/{id}/seats`), bookings (`hold`, `release`, `extend`, `{id}`, `cancel`), addons, coupons (`validate`), payments (`create-order`, `verify`, `webhook`, `refund`), tickets, reviews, watchlist, search, notifications, admin/*. Pydantic schemas, consistent error format, pagination, rate limiting, request IDs, structured logs, CORS locked down. WS: `/ws/showtimes/{id}`.

## 5. Design system
Light, rich-colour, simple UI per `DESIGN_SPEC.md`: warm ivory background, white cards, vivid colour bands, crimson primary actions, large readable type (18 px body, nothing under 14 px), poster-first layouts, generous spacing, subtle motion, one primary action per screen. Tokens in Tailwind config; reusable components (MovieCard, CinemaRow, ShowtimeChip, DateStrip, FilterBar, SeatLegend, PriceSummary, HoldTimer, Stepper, EmptyState, ErrorState, Toasts). Avoid generic-dashboard, cartoon, clutter. Fully responsive (mobile-first), dark by default (+ light optional), performance budgets: LCP < 2.5 s on mid-range mobile for non-3D pages, 3D route lazy-loaded.

## 6. Security & compliance
**`SECURITY_SPEC.md` is the authoritative security requirement set**: MFA for staff, refresh-token reuse detection, abuse and seat-hoarding controls, payment and webhook verification, signed single-use QR tickets, strict CSP (compatible with 3D and video), upload and media-pipeline hardening, supply-chain scanning, and the required security tests. Summary:
OWASP ASVS-aligned: input validation, parameterised queries, authZ on every route (role + ownership checks), CSRF, secure cookies, security headers/CSP, rate limits, brute-force protection, secret management via env, no secrets or Razorpay key secret in frontend, webhook signature verification, PII minimisation, audit logs, dependency scanning, upload validation (images/GLB size/type, virus-scan hook). Never trust client payment status.

## 7. Phased plan (runnable at the end of every phase; report after each)
1. **Foundation**: monorepo, docker-compose (postgres, redis, backend, frontend, mailpit), env, migrations, seed, health checks, CI lint/test.
2. **Core site**: design system, city selector, home, search, movies list/detail, cinemas list/detail, showtime selection (all with real API data).
3. **3D module**: implement `ANTIGRAVITY_PROMPT.md` and wire it to real seat inventory + WebSocket.
4. **Booking engine**: holds, inventory, concurrency, expiry sweeper, add-ons, coupons, checkout, countdown.
5. **Payments & tickets**: Razorpay test, verify, webhooks, refunds, QR/PDF tickets, email, profile history.
6. **Accounts & content**: OTP/email auth, profile, watchlist, reviews, offers, CMS, SEO, i18n.
7. **Admin & partner portals + analytics**.
8. **Hardening**: load/concurrency tests, security pass, a11y audit, Lighthouse, PWA (manifest + service worker for static shell, offline ticket view), deployment docs.

## 8. Testing requirements (with evidence)
- Backend pytest: booking concurrency (N parallel clients fight for the same seat → exactly one wins), hold expiry, expired-hold-then-payment → refund path, webhook idempotency/out-of-order/bad signature, price & tax math, coupon rules, authZ matrix, cancellation/refund rules.
- Frontend: unit (Vitest) + component tests; **Playwright E2E** of the full journey: city → movie → showtime → 3D seat select → POV → compare → hold → add-on → coupon → Razorpay test payment → QR ticket → profile history → cancel; plus two-browser test proving a seat held in browser A turns amber in browser B live. Mobile viewport + touch tests. Accessibility (axe) checks on key pages. WebGL-unavailable fallback test.
- Save screenshots/videos in `docs/evidence/`. Final report = table of every feature with PASS/FAIL/NOT DONE and evidence path. Be explicit about anything unimplemented.

## 9. Deliverables
Runnable via `docker compose up` (+ documented non-Docker dev commands), `README.md`, `docs/architecture.md`, `docs/database.md`, `docs/api.md`, `docs/3d-*.md`, `docs/security.md`, `docs/decisions.md`, `.env.example`, test credentials list for demo users (admin, manager, customer), Razorpay test card/UPI instructions.

## 10. Legal/brand notes
Use the name **CineVerse**. Do not copy BookMyShow/PVR branding, assets, copy or UI literally — match capability, not appearance. Use only original or placeholder posters/titles/music; no copyrighted artwork or trailers bundled. Do not scrape other platforms.

## 11. Rules
Real working features only — no dead buttons (label unfinished ones "Coming soon" + disabled + reason). No fake API responses where a feature must work; dev mocks (SMS, email, OTP, payment gateway keys) must sit behind clearly named provider interfaces. Keep frontend/backend responsibilities separate. Handle errors, loading and empty states everywhere. Responsive everywhere.

## 12. Mobile app (NEXT, after the website passes §8)
Do not build it now, but prepare: stable versioned `/api/v1`, OpenAPI client generation, token auth usable by native (refresh via body/secure storage option), push-notification device-token endpoint + table, deep-link-friendly URLs, QR ticket endpoint usable offline. Recommended later approach: **React Native (Expo) app consuming the same API**, with the 3D auditorium delivered either via WebView of the same R3F route (fastest, shares code) or `expo-gl` + R3F native (heavier). Decide after measuring 3D performance on real mid-range Android devices. Until then the website ships as an installable PWA.
