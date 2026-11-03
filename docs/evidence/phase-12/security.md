# Phase 12 — Venue Operations and Scale: Security & Architectural Specification

This document details the security constraints, privacy safeguards, cryptographic integrity checks, and rate-limiting controls implemented for CineVerse Phase 12 Venue Operations and Scale.

---

## 1. Role-Based Access Control (RBAC) & Token Scopes

All operational endpoints enforce strict role verification using JWT bearer tokens:

| Endpoint Subsystem | Route Prefix | Allowed Roles | Authentication Dependency |
|---|---|---|---|
| **Auditorium Onboarding** | `/api/v1/admin/onboarding/*` | `ADMIN`, `CINEMA_MANAGER` | `require_cinema_manager` |
| **Entry Turnstile Scanning** | `/api/v1/staff/*` | `STAFF`, `CINEMA_MANAGER`, `ADMIN` | `require_role(["STAFF", "CINEMA_MANAGER", "ADMIN"])` |
| **Kitchen Display System (KDS)** | `/api/v1/food/kds/*` | `STAFF`, `CINEMA_MANAGER`, `ADMIN` | `require_role(["STAFF", "CINEMA_MANAGER", "ADMIN"])` |
| **At-Seat Food Ordering** | `/api/v1/food/order` | `CUSTOMER`, `STAFF`, `CINEMA_MANAGER`, `ADMIN` | `require_user` |
| **Loyalty & Subscriptions** | `/api/v1/loyalty/*` | `CUSTOMER`, `STAFF`, `CINEMA_MANAGER`, `ADMIN` | `require_user` |
| **Ticket Transfer** | `/api/v1/tickets/{id}/transfer` | `CUSTOMER` (Ticket Owner Only) | `require_user` + Ownership Check |

---

## 2. Cryptographic Single-Use QR Pass Verification

Turnstile entry passes rely on HMAC-SHA256 digital signatures to prevent forgery, screenshot reuse, and duplicate entries:

1. **Payload Structure**:
   - Format: `TKT-{NUMBER}|{SHOWTIME_ID}|{SEATS_CSV}|{HMAC_SIGNATURE}` (or signed JSON object).
   - Signature: `HMAC_SHA256(f"{booking_code}:{showtime_id}:{ticket_number}", SECRET_KEY)`.
2. **Atomic Invalidation**:
   - Scanning executes within an atomic database transaction.
   - If `ticket.is_used == True`, the entry is immediately rejected with `409 Conflict` (`ALREADY_USED`), returning the original scan timestamp and device ID.
   - Forged or altered signatures are rejected with `400 Bad Request` (`INVALID_HMAC_SIGNATURE`).
3. **Audit Trail**:
   - Every scan attempt (both `SUCCESS` and `ALREADY_USED`) is logged in `ticket_scan_logs` with `gate`, `device_id`, client timestamp, and scan result.

---

## 3. Offline-Tolerant Queue & Conflict Resolution

Turnstile scanning clients operate offline when network connectivity drops:
1. Scans are queued in local indexed storage with an ISO-8601 millisecond-precision timestamp.
2. Upon reconnection, batches are submitted to `/api/v1/staff/scan/batch`.
3. If two devices scanned the same ticket offline, the scan with the **earlier client timestamp** receives `SUCCESS`; the second scan receives `ALREADY_USED`.

---

## 4. Kitchen Display System (KDS) PII Minimization

To comply with privacy best practices and ISO/IEC 27701 standards, the Kitchen Display System (KDS) strictly omits customer Personally Identifiable Information (PII):
- **Omitted**: Customer full name, phone number, email address, payment details.
- **Included**: Target seat (e.g. `Row E, Seat E05`), order ID, item quantities, and preparation timestamp.
- Staff delivering concessions see only the seat coordinate where the customer is seated.

---

## 5. Limited Ticket Transfer Security Protocol

Ticket transfers permit patrons to send tickets to friends while strictly preventing scalping and ticket duplication:
1. **Cutoff Rule**: Tickets can only be transferred up to 2 hours prior to the showtime start time (`showtime.start_time - now >= 2 hours`).
2. **Monthly Limit**: Accounts are rate-limited to a maximum of 5 transfers per calendar month.
3. **Cryptographic Invalidation**: The original ticket's QR code and HMAC signature are deleted. A new ticket record with a freshly generated ticket number (`TKT-...`) and newly signed HMAC is issued directly to the recipient's account.
4. **Audit Logging**: Every transfer is recorded in `ticket_transfer_logs` capturing sender ID, recipient ID, original ticket number, new ticket number, and IP address.

---

## 6. Auditorium GLB Upload Sandboxing

The 3D Auditorium Onboarding tool processes untrusted GLB files uploaded by venue operators:
1. **Zero External C-Library Dependencies**: Uses a pure-Python parser using Python standard library `struct` and `math` to parse the glTF JSON chunk and binary buffers without native buffer overflow risks.
2. **Coordinate Space Detection**: Detects column-major transformation matrices (e.g. Blender Z-up converted to glTF Y-up) and maps node geometries to standard `glTF_Y_UP`.
3. **Budget Enforcement**: Rejects models missing screen nodes (`MISSING_SCREEN`) and flags meshes exceeding the recommended triangle budget (> 300,000 triangles).
4. **Version Rollback**: Asset versions (`TheatreAssetVersion`) are stored immutably. Rollbacks re-activate previous versions atomically without dropping history.
