# CineVerse API & Real-Time WebSocket Specifications

All REST endpoints are versioned under `/api/v1` and return JSON responses with standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Content`).

---

## 1. Authentication Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/register`
Creates a new customer account.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "full_name": "Karthik Verma",
    "phone": "9876543210",
    "preferred_city_id": 1
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "4b18f340...",
    "token_type": "bearer",
    "user_id": 4,
    "role": "customer",
    "full_name": "Karthik Verma"
  }
  ```

### `POST /api/v1/auth/login`
Authenticates via email and password.
- **Request Body**: `{"email": "admin@cineverse.in", "password": "Admin@123"}`
- **Response** (`200 OK`): Returns JWT `access_token` (60m) and `refresh_token` (30d).

### `POST /api/v1/auth/otp/request` & `POST /api/v1/auth/otp/verify`
Passwordless 6-digit SMS OTP sign-in flow.

---

## 2. Catalog & Theatres (`/api/v1/movies`, `/api/v1/cinemas`)

### `GET /api/v1/movies`
Retrieves movie catalog with optional query filters:
- `city_id` (int): Filters movies currently showing in a specific city.
- `format` (string): `IMAX 3D`, `4DX`, `2D Dolby Atmos`.
- `genre` (string): `Sci-Fi`, `Action`, `Drama`, etc.
- `search` (string): Substring search across titles.

### `GET /api/v1/movies/{id}/showtimes`
Returns 7-day scheduled screenings for a movie grouped by cinema complex, with live occupancy indicators (`AVAILABLE`, `FAST_FILLING`, `ALMOST_FULL`).

### `GET /api/v1/cinemas` & `GET /api/v1/cinemas/{id}`
Returns cinema facilities, address, cancellation policies, and active screening halls.

---

## 3. 3D Auditorium & Live Seats (`/api/v1/showtimes`, `/ws/showtimes`)

### `GET /api/v1/showtimes/{id}/seats`
Returns the real-time seat inventory for a showtime, including physical 3D sightline metrics for each seat:
- **Response Item**:
  ```json
  {
    "seat_id": "F05",
    "node_name": "seat_F_05",
    "row": "F",
    "number": 5,
    "category": "Prime",
    "price": 380.0,
    "status": "AVAILABLE",
    "held_by_current_user": false,
    "distance_to_screen": 6.23,
    "vertical_angle_deg": 7.0,
    "horizontal_angle_deg": -4.8
  }
  ```

### `WS /ws/showtimes/{showtime_id}`
Bidirectional WebSocket stream providing instant inventory status fan-out:
- **Client Receives on Event**:
  ```json
  {
    "event": "SEAT_HOLD",
    "showtime_id": 1,
    "seat_ids": ["F05", "F06"],
    "hold_id": "hold_72485b2e8f29",
    "status": "HELD"
  }
  ```

---

## 4. Atomic Holds, Booking & Checkout (`/api/v1/bookings`)

### `POST /api/v1/bookings/hold`
Atomically holds 1 to 8 seats for 5 minutes.
- **Request Body**:
  ```json
  {
    "showtime_id": 1,
    "seat_ids": ["F05", "F06"]
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "hold_id": "hold_72485b2e8f29",
    "showtime_id": 1,
    "seat_ids": ["F05", "F06"],
    "expires_at": "2026-11-02T18:25:00Z",
    "duration_seconds": 300
  }
  ```

### `POST /api/v1/bookings/extend`
Extends an active hold by 180 seconds (+3 minutes).

### `POST /api/v1/bookings/create`
Transforms active held seats into a pending booking with pricing and tax calculation.

---

## 5. Payments & E-Tickets (`/api/v1/payments`, `/api/v1/tickets`)

### `POST /api/v1/payments/razorpay/create-order`
Creates an authorized Razorpay transaction order.

### `POST /api/v1/payments/razorpay/verify`
Validates Razorpay payment signature, confirms booking, marks seats `BOOKED`, and issues the verifiable signed QR e-ticket.

### `POST /api/v1/payments/razorpay/webhook`
Idempotent webhook handler with HMAC SHA-256 header verification preventing double confirmation.

### `GET /api/v1/tickets/{ticket_number}/verify`
Offline/online scanner gate check verifying ticket authenticity against the HMAC signature.

---

## 6. Admin Analytics (`/api/v1/admin`)

### `GET /api/v1/admin/analytics`
Restricted to `RoleEnum.ADMIN` and `RoleEnum.CINEMA_MANAGER`. Returns aggregate gross revenue, confirmed bookings count, tickets sold, overall screen occupancy percentage, and top grossing movies.

