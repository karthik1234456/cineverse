import uuid
import time
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.redis_client import get_redis_client
from app.services.captcha_service import TurnstileCaptchaVerifier
from app.models.auth import RoleEnum, User
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.services.auth_service import hash_password, create_access_token


@pytest.mark.asyncio
async def test_captcha_turnstile_verifier_unit():
    """Test 13: CAPTCHA verification unit tests (valid, invalid, accessible, dev bypass)."""
    verifier = TurnstileCaptchaVerifier()

    # Valid turnstile test token
    assert await verifier.verify("1x0000000000000000000000000000000AA") is True
    assert await verifier.verify("test-pass-token") is True
    assert await verifier.verify("dev-turnstile-pass") is True

    # Invalid turnstile token
    assert await verifier.verify("2x0000000000000000000000000000000AA") is False
    assert await verifier.verify("test-fail-token") is False
    assert await verifier.verify("invalid-token-12345") is False

    # Empty token
    assert await verifier.verify("") is False
    assert await verifier.verify(None) is False

    # Accessible fallback format: "accessible:{challenge_id}:{answer}"
    assert await verifier.verify("accessible:chal1:42") is True
    assert await verifier.verify("accessible:chal2:pass") is True
    assert await verifier.verify("accessible:chal3:wrong_and_not_matching") is False


@pytest.mark.asyncio
async def test_seat_hoarding_max_seats_per_booking(client: AsyncClient):
    """Test 3: Reject hold when seat count exceeds 8 seats per booking."""
    seats_9 = [f"A0{i}" for i in range(1, 10)]
    resp = await client.post(
        "/api/v1/bookings/hold",
        json={
            "showtime_id": 1,
            "seat_ids": seats_9
        }
    )
    assert resp.status_code == 400
    data = resp.json()
    assert "8 seats" in data.get("detail", "").lower()


@pytest.mark.asyncio
async def test_seat_hoarding_single_active_hold_per_show(client: AsyncClient, db_session):
    """Test 4: Single active hold per user per show (second hold on same showtime rejected)."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"hoarder_{uid}@example.com",
        hashed_password=hash_password("Pass123!"),
        full_name="Hoarder Test",
        role=RoleEnum.CUSTOMER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    auth_headers = {"Authorization": f"Bearer {token}"}

    # First hold on showtime 1 succeeds
    resp1 = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 1, "seat_ids": ["B01"]},
        headers=auth_headers
    )
    assert resp1.status_code == 200

    # Second hold on same showtime 1 from same user is rejected with 409 Conflict
    resp2 = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 1, "seat_ids": ["B02"]},
        headers=auth_headers
    )
    assert resp2.status_code == 409
    assert "already exists for this showtime" in resp2.json().get("detail", "")


@pytest.mark.asyncio
async def test_seat_hoarding_max_concurrent_shows(client: AsyncClient, db_session):
    """Test 5: Detection of one account holding multiple shows simultaneously (max 2)."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"multishow_{uid}@example.com",
        hashed_password=hash_password("Pass123!"),
        full_name="MultiShow Test",
        role=RoleEnum.CUSTOMER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Hold on Showtime 1
    resp1 = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 1, "seat_ids": ["B03"]},
        headers=auth_headers
    )
    assert resp1.status_code == 200, f"Hold 1 failed: {resp1.text}"

    # Hold on Showtime 2
    resp2 = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 2, "seat_ids": ["A01"]},
        headers=auth_headers
    )
    assert resp2.status_code == 200, f"Hold 2 failed: {resp2.text}"

    # 3rd hold across 3rd distinct showtime (Showtime 3) is rejected with 409 Conflict
    resp3 = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 3, "seat_ids": ["A01"]},
        headers=auth_headers
    )
    assert resp3.status_code == 409
    assert "multiple shows exceeded" in resp3.json().get("detail", "")


@pytest.mark.asyncio
async def test_seat_hoarding_simultaneous_holds_per_ip_cap(client: AsyncClient):
    """Test 6: Cap on simultaneous active holds per IP (max 5)."""
    ip_header = {"X-Forwarded-For": "198.51.100.99"}

    # Create 5 simultaneous holds from the same IP on showtime 1 using distinct available seats
    available_test_seats = ["E01", "E02", "E03", "E04", "E05"]
    for i, seat in enumerate(available_test_seats):
        resp = await client.post(
            "/api/v1/bookings/hold",
            json={"showtime_id": 1, "seat_ids": [seat]},
            headers=ip_header
        )
        assert resp.status_code == 200, f"Hold {i+1} failed: {resp.text}"

    # 6th simultaneous hold from the same IP exceeds limit of 5
    resp6 = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 1, "seat_ids": ["E06"]},
        headers=ip_header
    )
    assert resp6.status_code == 429
    assert "Seat hoarding detected" in resp6.json().get("detail", "")


@pytest.mark.asyncio
async def test_expired_holds_cooldown(client: AsyncClient, db_session):
    """Test 7: Cooldown after 3 repeated expired holds (blocks subsequent holds with 429)."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"cooldown_{uid}@example.com",
        hashed_password=hash_password("Pass123!"),
        full_name="Cooldown Test",
        role=RoleEnum.CUSTOMER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    auth_headers = {"Authorization": f"Bearer {token}"}

    redis = await get_redis_client()
    # Simulate 3 expired holds triggering 15-minute cooldown
    await redis.setex(f"fraud:cooldown:user:{user.id}", 900, "1")

    # Next hold attempt is rejected with 429 and Retry-After
    resp = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 1, "seat_ids": ["B04"]},
        headers=auth_headers
    )
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers
    assert "cooldown active" in resp.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_hold_rate_limit_per_user(client: AsyncClient, db_session):
    """Test 1: Shared sliding-window rate limit per user on seat holds (10/min -> 11th 429)."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"ratelimit_user_{uid}@example.com",
        hashed_password=hash_password("Pass123!"),
        full_name="RateLimit User",
        role=RoleEnum.CUSTOMER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Make 10 hold + release requests within 1 minute
    for i in range(10):
        h_resp = await client.post(
            "/api/v1/bookings/hold",
            json={"showtime_id": 1, "seat_ids": ["B05"]},
            headers=auth_headers
        )
        assert h_resp.status_code == 200, f"Request {i+1} failed: {h_resp.text}"
        hold_id = h_resp.json()["hold_id"]

        # Release hold immediately so next hold can be created without duplicate conflict
        r_resp = await client.post(
            "/api/v1/bookings/release",
            json={"hold_id": hold_id, "seat_ids": ["B05"]},
            headers=auth_headers
        )
        assert r_resp.status_code == 200

    # 11th hold attempt exceeds limit of 10/min
    blocked_resp = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 1, "seat_ids": ["B05"]},
        headers=auth_headers
    )
    assert blocked_resp.status_code == 429
    assert "Retry-After" in blocked_resp.headers
    assert int(blocked_resp.headers["Retry-After"]) > 0


@pytest.mark.asyncio
async def test_hold_rate_limit_per_ip(client: AsyncClient):
    """Test 2: Shared sliding-window rate limit per IP on seat holds (30/min -> 31st 429)."""
    ip_headers = {"X-Forwarded-For": "198.51.100.44"}

    # 30 hold + release cycles
    for i in range(30):
        h_resp = await client.post(
            "/api/v1/bookings/hold",
            json={"showtime_id": 1, "seat_ids": ["B06"]},
            headers=ip_headers
        )
        assert h_resp.status_code == 200, f"IP request {i+1} failed: {h_resp.text}"
        hold_id = h_resp.json()["hold_id"]

        await client.post(
            "/api/v1/bookings/release",
            json={"hold_id": hold_id, "seat_ids": ["B06"]},
            headers=ip_headers
        )

    # 31st request exceeds IP limit
    blocked = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": 1, "seat_ids": ["B06"]},
        headers=ip_headers
    )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


@pytest.mark.asyncio
async def test_otp_send_rate_limit_and_captcha(client: AsyncClient):
    """Test 8: OTP flood (3 per 10m allowed, 4th 429, CAPTCHA required after 2)."""
    phone = "9876543210"
    client_ip_hdr = {"X-Forwarded-For": "203.0.113.10"}

    # 1st OTP send -> 200 OK
    r1 = await client.post("/api/v1/auth/otp/send", json={"phone": phone}, headers=client_ip_hdr)
    assert r1.status_code == 200

    # 2nd OTP send -> 200 OK
    r2 = await client.post("/api/v1/auth/otp/send", json={"phone": phone}, headers=client_ip_hdr)
    assert r2.status_code == 200

    # 3rd OTP send without CAPTCHA -> 400 Bad Request (CAPTCHA challenge required after 2 requests)
    r3_no_captcha = await client.post(
        "/api/v1/auth/otp/send",
        json={"phone": phone},
        headers=client_ip_hdr
    )
    assert r3_no_captcha.status_code == 400
    assert "verification required" in r3_no_captcha.json().get("detail", "").lower()

    # 4th OTP send -> 429 Too Many Requests (Rate limit: 3 per 10m per phone)
    r4_blocked = await client.post(
        "/api/v1/auth/otp/send",
        json={"phone": phone, "captcha_token": "test-pass-token"},
        headers=client_ip_hdr
    )
    assert r4_blocked.status_code == 429
    assert "Retry-After" in r4_blocked.headers


@pytest.mark.asyncio
async def test_login_brute_force_and_captcha(client: AsyncClient, db_session):
    """Test 9: Login brute force protection (CAPTCHA on >= 2 failures, rate limit 429)."""
    uid = uuid.uuid4().hex[:8]
    email = f"brute_{uid}@cineverse.in"
    user = User(
        email=email,
        hashed_password=hash_password("RealPassword123!"),
        full_name="Brute Target",
        role=RoleEnum.CUSTOMER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    ip_hdr = {"X-Forwarded-For": "198.51.100.70"}

    # Attempt 1: Failed password
    f1 = await client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword1"}, headers=ip_hdr)
    assert f1.status_code == 401

    # Attempt 2: Failed password
    f2 = await client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword2"}, headers=ip_hdr)
    assert f2.status_code == 401

    # Attempt 3: No CAPTCHA provided after 2 failures -> 400 Bad Request
    f3_no_cap = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword3"},
        headers=ip_hdr
    )
    assert f3_no_cap.status_code == 400
    assert "verification required" in f3_no_cap.json().get("detail", "").lower()

    # Attempt 3: Invalid CAPTCHA token -> 400 Bad Request
    f3_inv_cap = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword3", "captcha_token": "test-fail-token"},
        headers=ip_hdr
    )
    assert f3_inv_cap.status_code == 400

    # Attempt 3: Valid CAPTCHA token with bad password -> 401 Unauthorized (allowed through to auth)
    f3_valid_cap = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword3", "captcha_token": "test-pass-token"},
        headers=ip_hdr
    )
    assert f3_valid_cap.status_code == 401


@pytest.mark.asyncio
async def test_payments_create_order_rate_limit(client: AsyncClient, db_session):
    """Test 10: Payment spam protection (5 per 10m allowed, 6th 429)."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"payer_{uid}@example.com",
        hashed_password=hash_password("Pass123!"),
        full_name="Payer Test",
        role=RoleEnum.CUSTOMER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    auth_headers = {"Authorization": f"Bearer {token}"}

    for i in range(5):
        resp = await client.post(
            "/api/v1/payments/create-order",
            json={"booking_id": 1, "amount": 250.0},
            headers=auth_headers
        )
        assert resp.status_code != 429, f"Request {i+1} got unexpected 429"

    # 6th request triggers rate limit
    r6 = await client.post(
        "/api/v1/payments/create-order",
        json={"booking_id": 1, "amount": 250.0},
        headers=auth_headers
    )
    assert r6.status_code == 429
    assert "Retry-After" in r6.headers


@pytest.mark.asyncio
async def test_normal_user_isolation(client: AsyncClient):
    """Test 11: Rate limiting IP A does not interfere with normal User/IP B."""
    abusive_ip = {"X-Forwarded-For": "198.51.100.11"}
    normal_ip = {"X-Forwarded-For": "198.51.100.22"}

    # Payments endpoint has IP limit of 10 per 10m
    for _ in range(10):
        await client.post("/api/v1/payments/create-order", json={"booking_id": 1, "amount": 100}, headers=abusive_ip)

    # 11th request for abusive IP gets 429
    blocked = await client.post("/api/v1/payments/create-order", json={"booking_id": 1, "amount": 100}, headers=abusive_ip)
    assert blocked.status_code == 429

    # Normal IP gets through normally without 429
    clean = await client.post("/api/v1/payments/create-order", json={"booking_id": 1, "amount": 100}, headers=normal_ip)
    assert clean.status_code != 429


@pytest.mark.asyncio
async def test_multi_instance_redis_sharing():
    """Test 12: Multiple backend instances share the same Redis rate limit window."""
    transport = ASGITransport(app=app)
    ip_headers = {"X-Forwarded-For": "198.51.100.33"}

    # Payments endpoint has IP limit of 10 per 10m
    async with AsyncClient(transport=transport, base_url="http://node-a") as node_a:
        async with AsyncClient(transport=transport, base_url="http://node-b") as node_b:
            # Send 6 requests from node_a
            for _ in range(6):
                await node_a.post("/api/v1/payments/create-order", json={"booking_id": 1, "amount": 100}, headers=ip_headers)

            # Send 4 requests from node_b (total = 10)
            for _ in range(4):
                await node_b.post("/api/v1/payments/create-order", json={"booking_id": 1, "amount": 100}, headers=ip_headers)

            # 11th request on node_b is blocked with 429, proving shared Redis window across instances
            r_blocked = await node_b.post("/api/v1/payments/create-order", json={"booking_id": 1, "amount": 100}, headers=ip_headers)
            assert r_blocked.status_code == 429
            assert "Retry-After" in r_blocked.headers


@pytest.mark.asyncio
async def test_admin_security_telemetry_and_blocking(client: AsyncClient):
    """Test 14: Admin security telemetry, manual IP block and unblock controls."""
    # Login as admin
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@cineverse.in", "password": "Admin@123"}
    )
    assert login_resp.status_code == 200
    admin_token = login_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Fetch metrics
    metrics_resp = await client.get("/api/v1/admin/security/metrics", headers=admin_headers)
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert "global_counters" in metrics
    assert "blocked_targets" in metrics
    assert "active_blocks_count" in metrics

    # 2. Block malicious IP
    bad_ip = "198.51.100.55"
    block_resp = await client.post(
        "/api/v1/admin/security/block",
        json={"target_type": "ip", "target_id": bad_ip, "duration_minutes": 30, "reason": "Bot flood"},
        headers=admin_headers
    )
    assert block_resp.status_code == 200
    assert block_resp.json()["status"] == "blocked"

    # 3. Malicious IP is now blocked with 403 Forbidden
    blocked_req = await client.get(
        "/api/v1/search?q=Movie",
        headers={"X-Forwarded-For": bad_ip}
    )
    assert blocked_req.status_code == 403
    assert "restricted" in blocked_req.json().get("detail", "").lower()

    # 4. Unblock malicious IP
    unblock_resp = await client.post(
        "/api/v1/admin/security/unblock",
        json={"target_type": "ip", "target_id": bad_ip},
        headers=admin_headers
    )
    assert unblock_resp.status_code == 200
    assert unblock_resp.json()["status"] == "unblocked"

    # 5. Malicious IP is allowed again
    restored_req = await client.get(
        "/api/v1/search?q=Movie",
        headers={"X-Forwarded-For": bad_ip}
    )
    assert restored_req.status_code == 200
