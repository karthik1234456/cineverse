# CineVerse — Security specification

Applies to every phase. Each phase must satisfy the items marked for it and record evidence in `docs/evidence/phase-N/security.md`. Start with a short threat model (`docs/threat-model.md`, STRIDE per component) in Phase 1 and update it each phase. "Secure" claims need tests, not intentions. No tool may ever receive real payment live keys or production secrets.

## 1. Identity and sessions (Phase 1, 6)
- Passwords: Argon2id (tuned parameters), breach-list check (k-anonymity), minimum length 10, no composition theatre.
- Access token 10–15 min; refresh token rotating with **reuse detection** (reuse revokes the whole family); httpOnly, Secure, SameSite=Lax/Strict cookies; CSRF token for state-changing cookie-authenticated requests; device/session list with revoke; logout everywhere.
- MFA: TOTP **mandatory for admin and cinema_manager**, optional for customers; passkeys (WebAuthn) as a stretch; recovery codes hashed.
- Phone OTP: 6 digits, 5-min expiry, single use, hashed at rest, attempt and resend limits, per-phone and per-IP throttles, provider interface so SMS pumping can be capped (daily budget).
- Login/register/reset: uniform error messages (no account enumeration), progressive delays, lockout with unlock by email, CAPTCHA (Turnstile/hCaptcha) after anomalies.
- Roles enforced server-side on every route (deny by default). Use UUIDs/opaque IDs; **every object access checks ownership** (IDOR tests for bookings, tickets, profiles, payments, conversations).

## 2. Booking and abuse resistance (Phase 4)
- Seat-hoarding bots: per-user and per-IP hold limits, max simultaneous holds per account, hold-rate throttling, hold cooldown after repeated expiries, optional waiting-room/queue for hot releases, behavioural signals logged.
- Idempotency keys on hold/pay/cancel; all state changes inside DB transactions; server computes all prices, taxes and discounts (never trust client amounts, seat categories or coupon results).
- Coupons: per-user and global limits, atomic redemption, no stacking exploits; test race conditions.
- WebSocket: authenticate on connect (short-lived token), origin check, per-connection and per-IP message and rate limits, max message size, server-authoritative state only (client messages are requests, never facts), heartbeat and idle timeout, no PII in broadcasts.

## 3. Payments (Phase 5)
- Razorpay hosted checkout keeps us in the lightest PCI scope (SAQ-A style): **never see, log or store card/UPI credentials**.
- Orders created server-side with server-computed amount; verify `razorpay_signature` (HMAC-SHA256) with **constant-time comparison**; webhook signature verification over the raw body, replay window and event-id idempotency table, out-of-order safe; amount/currency/order-id cross-checks against our records before confirming.
- Never trust the client success callback; the UI polls booking status. Paid-after-expiry triggers automatic refund. Reconciliation job for stuck payments. Refund endpoints admin-only with audit logging and MFA step-up.
- Key handling: key secret and webhook secret only in server env/secret manager, rotated, never in the frontend bundle, repo or logs.

## 4. Tickets and QR (Phase 5)
- QR payload = compact signed token (Ed25519 or HMAC-SHA256, key rotation via `kid`) containing ticket ID and expiry, **no personal data**.
- Server-side validation endpoint for scanners (staff role, rate-limited): single-use state (`VALID → USED`) with atomic transition; duplicate scan returns "already used" with time. Optional rotating QR (refreshes every 30–60 s) close to showtime to defeat screenshots; offline view shows the last token with a visible validity warning.

## 5. Web application hardening (Phases 1–3, verified in 8)
- Security headers: strict CSP with nonces (allow `worker-src blob:` for 3D, `media-src` for the video CDN and `blob:`, `img-src` for the CDN and `data:`; no `unsafe-inline`/`unsafe-eval` in production), HSTS (preload-ready), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (microphone only on routes with the voice agent; camera/geolocation off unless used), frame-ancestors none, COOP `same-origin`. Test that the 3D viewer and video textures still work under the production CSP (video needs CORS).
- CORS: explicit allow-list, no wildcard with credentials. Cookies scoped tightly. SRI for any third-party script; prefer self-hosting; no third-party scripts on payment/checkout pages beyond Razorpay.
- Input validation with strict Pydantic/Zod schemas, request size limits, content-type checks; output encoding by default (React), no `dangerouslySetInnerHTML` without a sanitizer (DOMPurify) and review; Markdown/HTML from admins and reviews sanitized server-side.
- Rate limits per route class using Redis sliding windows (auth, search, hold, pay, review, OTP, agent), plus global abuse protection; consistent 429 with `Retry-After`.
- SSRF: no server-side fetching of user-supplied URLs except through an allow-listed fetcher (block private IP ranges, redirects limited, timeouts, size caps).
- Search and filters via parameterised queries only; no raw SQL string building; ORM for everything else; DB errors never leaked to clients.

## 6. Files and media (Phases 3, 7)
- GLB/model uploads: size cap, extension and magic-byte validation, parse in a sandboxed worker (no execution of embedded scripts or external URIs; reject external buffer/image URIs), triangle/node budgets, node-name allow-list pattern, checksum, versioning; preview only after validation.
- Images: re-encode server-side (strip EXIF), dimension/size caps, safe filenames, random object keys, served from a separate cookieless domain/CDN with `Content-Disposition` and correct `Content-Type`.
- Videos/trailers: upload by admin only through signed upload URLs, virus scan hook (ClamAV), duration/size/codec limits, transcode in an isolated worker (ffmpeg with resource limits), HLS renditions, captions as sanitized WebVTT; **signed, expiring playback URLs**, hotlink protection, `Cache-Control` tuned; store rights-holder and licence info per asset (admin must confirm rights before publishing).
- Never accept or fetch third-party video from URLs to host it ourselves unless rights are confirmed.

## 7. Data, privacy, compliance (Phases 1, 6, 8)
- DPDP-aware: purpose-specific consent, data minimisation, retention periods, export and deletion flows, grievance contact, breach-response runbook. Encrypt sensitive fields at rest where appropriate (phone, email optional), TLS everywhere including DB and Redis, encrypted backups with tested restore.
- Logging: structured, request IDs, **no passwords, tokens, OTPs, card data, full phone/email, or audio/transcripts by default**; admin actions in an append-only audit log; alerts for repeated auth failures, refund spikes, unusual hold patterns, webhook signature failures.
- DB roles: least-privilege app role, separate migration role, no superuser in the app, statement timeouts, connection limits. Redis requires auth, not exposed publicly.

## 8. Supply chain, build and infra (Phases 1, 8)
- Pin dependencies with lockfiles; automated updates (Renovate/Dependabot); `pip-audit`, `npm audit` (or Socket/Snyk equivalent), SBOM generation; SAST (Bandit, Semgrep, ESLint security rules); secret scanning (gitleaks) in pre-commit and CI; fail CI on high severity.
- Containers: minimal base images, non-root user, read-only filesystem where possible, dropped capabilities, resource limits, health checks, no secrets baked into images, images scanned (Trivy). Nginx or ingress with TLS, request limits, WAF rules (OWASP CRS) if available.
- Environments separated; production secrets only in the secret manager; `.env.example` contains no real values. Razorpay live mode stays off until the checklist in `docs/go-live.md` is signed off.

## 9. Voice agent specifics (Phase 9)
Mic after explicit tap only; no audio retention by default; agent acts as the user with a tool allow-list, confirmation cards for state changes, payment never by voice, untrusted-content isolation against prompt injection, per-user rate and spend limits, full tool-call audit log, cross-user access tests.

## 10. Required security testing (evidence in each phase report)
- **AuthZ matrix tests** for every route and role; IDOR tests; token tampering, expiry, refresh reuse; CSRF tests; mass-assignment tests.
- **Abuse tests:** seat-hoarding script, coupon race, webhook replay/duplicate/forged signature, OTP brute force, WebSocket flood, oversized payloads, malformed GLB/image/video uploads, XSS payloads in reviews/names/movie fields, SQLi probes on search/filters, SSRF probes.
- **Scanners:** OWASP ZAP baseline against the running stack, header check (securityheaders-style), `npm audit`/`pip-audit`, Trivy, gitleaks; fix or document every finding.
- **Manual review checklist** (ASVS L2 subset) signed per phase; final pentest-style pass in Phase 8 with findings table (severity, status, fix, retest).
- Report honestly: what was tested, what was not, what remains risky.
