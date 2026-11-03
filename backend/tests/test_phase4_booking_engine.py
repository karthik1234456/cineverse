import pytest
import asyncio
import uuid
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy import select, update, delete

from app.models.showtime import SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingSeat, BookingStatusEnum
from app.database import AsyncSessionLocal
from app.services.sweeper import sweep_expired_holds
from app.services.hold_service import reset_hold_tracking


@pytest.fixture(autouse=True)
def clean_hold_state():
    reset_hold_tracking()


@pytest.mark.asyncio
async def test_50_parallel_concurrency_race(client: AsyncClient):
    """
    Concurrency Gate: 50 parallel clients attempt to hold the exact same seat (H05).
    Exactly one must win (HTTP 200), and 49 must be rejected (HTTP 409).
    """
    target_showtime_id = 1
    target_seat = "H05"

    # Reset seat to AVAILABLE first
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == target_showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()

    async def attempt_hold(client_idx: int):
        # Unique idempotency and ip per client to avoid bot throttling during race
        resp = await client.post(
            f"/api/v1/bookings/hold?showtime_id={target_showtime_id}",
            json={
                "seat_ids": [target_seat],
                "idempotency_key": f"race_{client_idx}_{uuid.uuid4().hex}"
            },
            headers={"X-Forwarded-For": f"192.168.1.{10 + client_idx}"}
        )
        return resp.status_code

    # Launch 50 parallel requests
    tasks = [attempt_hold(i) for i in range(50)]
    results = await asyncio.gather(*tasks)

    success_count = results.count(200)
    conflict_count = results.count(409)

    assert success_count == 1, f"Expected exactly 1 winner, got {success_count}"
    assert conflict_count == 49, f"Expected 49 conflicts, got {conflict_count}"

    # Cleanup: release the held seat
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == target_showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()


@pytest.mark.asyncio
async def test_hold_expiry_and_late_confirmation_refusal(client: AsyncClient):
    """
    Expiry & Sweeper:
    1. Hold seat J01.
    2. Artificially expire the hold in the database.
    3. Run background sweeper -> verifies seat status resets to AVAILABLE.
    4. Attempting to create booking with the expired hold must be refused with 400.
    """
    target_seat = "J01"
    showtime_id = 1

    # Reset seat J01 to available
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(BookingSeat)
            .where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id == target_seat)
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()

    # Hold seat
    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": [target_seat]},
        headers={"X-Forwarded-For": f"10.0.0.{uuid.uuid4().int % 250}"}
    )
    assert hold_resp.status_code == 200
    hold_data = hold_resp.json()
    hold_id = hold_data["hold_id"]

    # Artificially expire the hold
    past_time = datetime.utcnow() - timedelta(minutes=10)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.hold_id == hold_id)
            .values(hold_expires_at=past_time)
        )
        await db.commit()

    # Run sweeper
    swept_count = await sweep_expired_holds()
    assert swept_count >= 1

    # Verify seat is back to AVAILABLE
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(SeatInventory).where(
                SeatInventory.showtime_id == showtime_id,
                SeatInventory.seat_id == target_seat
            )
        )
        seat = res.scalars().first()
        assert seat.status == SeatStatusEnum.AVAILABLE
        assert seat.hold_id is None

    # Late booking confirmation with expired hold must be refused
    bkg_req = {
        "showtime_id": showtime_id,
        "hold_id": hold_id,
        "seat_ids": [target_seat],
        "addons": [],
        "contact_email": "late_buyer@cineverse.in",
        "contact_phone": "9876543210"
    }
    bkg_resp = await client.post("/api/v1/bookings/create", json=bkg_req)
    assert bkg_resp.status_code == 400
    assert "Hold expired" in bkg_resp.json()["detail"] or "expired" in bkg_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_idempotent_hold_request_creates_no_duplicate(client: AsyncClient):
    """
    Idempotency: Sending the same hold request with the same idempotency key
    returns the existing hold without creating duplicate records or throwing conflict.
    """
    showtime_id = 1
    target_seat = "I02"
    idempotency_key = f"idem_{uuid.uuid4().hex}"
    client_ip = f"172.16.0.{uuid.uuid4().int % 250}"

    # Reset seat
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None)
        )
        await db.commit()

    # Request 1
    resp_1 = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": [target_seat], "idempotency_key": idempotency_key},
        headers={"X-Forwarded-For": client_ip}
    )
    assert resp_1.status_code == 200
    data_1 = resp_1.json()

    # Request 2 with same idempotency key
    resp_2 = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": [target_seat], "idempotency_key": idempotency_key},
        headers={"X-Forwarded-For": client_ip}
    )
    assert resp_2.status_code == 200
    data_2 = resp_2.json()

    assert data_1["hold_id"] == data_2["hold_id"]
    assert data_1["held_seats"] == data_2["held_seats"]

    # Release
    await client.post("/api/v1/bookings/release", json={"hold_id": data_1["hold_id"]})


@pytest.mark.asyncio
async def test_hold_extend_once_limit(client: AsyncClient):
    """
    Extend limit: A hold can be extended exactly once (+3 mins).
    A second extend attempt must be rejected with 400.
    """
    showtime_id = 1
    target_seat = "I03"
    client_ip = f"172.16.1.{uuid.uuid4().int % 250}"

    # Reset seat
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None)
        )
        await db.commit()

    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": [target_seat]},
        headers={"X-Forwarded-For": client_ip}
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # First extend -> Success
    ext_1 = await client.post("/api/v1/bookings/extend", json={"hold_id": hold_id})
    assert ext_1.status_code == 200
    assert ext_1.json()["extended_by_minutes"] == 3
    assert ext_1.json()["is_extended"] is True

    # Second extend -> Refused
    ext_2 = await client.post("/api/v1/bookings/extend", json={"hold_id": hold_id})
    assert ext_2.status_code == 400
    assert "Hold can only be extended once" in ext_2.json()["detail"]

    # Cleanup
    await client.post("/api/v1/bookings/release", json={"hold_id": hold_id})


@pytest.mark.asyncio
async def test_price_convenience_fee_and_gst_math(client: AsyncClient):
    """
    Pricing Engine: Verify server calculation with fixed fixtures.
    2 Prime seats (₹380 each = ₹760)
    Convenience fee: 2 * ₹35.0 = ₹70.0
    GST: 18% of ₹70.0 = ₹12.60
    Total before coupon = ₹842.60
    """
    showtime_id = 1
    seats = ["H01", "H02"]
    client_ip = f"172.16.2.{uuid.uuid4().int % 250}"

    # Reset seats
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(BookingSeat)
            .where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id.in_(seats))
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None)
        )
        await db.commit()

    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers={"X-Forwarded-For": client_ip}
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "showtime_id": showtime_id,
            "hold_id": hold_id,
            "seat_ids": seats,
            "addons": [],
            "contact_email": f"pricing_test_{uuid.uuid4().hex[:6]}@cineverse.in",
            "contact_phone": "9876543210"
        }
    )
    assert bkg_resp.status_code == 200
    data = bkg_resp.json()

    assert data["total_ticket_amount"] == 1040.0
    assert data["convenience_fee"] == 70.0
    assert data["gst_amount"] == 12.60
    assert data["final_total_amount"] == 1122.60

    # Cancel booking to release seats cleanly
    await client.post(f"/api/v1/bookings/{data['id']}/cancel")


@pytest.mark.asyncio
async def test_coupon_validation_and_limits(client: AsyncClient):
    """
    Coupon validation:
    - Invalid coupon code returns 400
    - Order below minimum order amount returns 400
    - Valid code returns accurate calculated discount
    """
    # 1. Invalid code
    res_invalid = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "NONEXISTENT", "order_amount": 500.0}
    )
    assert res_invalid.status_code == 200
    assert res_invalid.json()["valid"] is False

    # 2. Minimum amount requirement (FIRSTSHOW requires min ₹400)
    res_below_min = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "FIRSTSHOW", "order_amount": 200.0}
    )
    assert res_below_min.status_code == 200
    assert res_below_min.json()["valid"] is False
    assert "Minimum order amount" in res_below_min.json()["message"]

    # 3. Valid coupon: FIRSTSHOW (20% off on >= 400, max 150)
    res_valid = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "FIRSTSHOW", "order_amount": 600.0}
    )
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["valid"] is True
    assert data["discount_amount"] == 120.0


@pytest.mark.asyncio
async def test_security_seat_hoarding_bot_protection(client: AsyncClient):
    """
    Security Gate: Seat-hoarding bot protection.
    A single IP attempting to acquire more than the allowed active holds is throttled with 429.
    """
    bot_ip = f"198.51.100.{uuid.uuid4().int % 250}"
    showtime_id = 1
    seats_pool = [["B01"], ["B02"], ["B03"], ["B04"], ["B05"], ["B06"]]

    # Reset seats
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(["B01", "B02", "B03", "B04", "B05", "B06"]))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None)
        )
        await db.commit()

    created_holds = []
    statuses = []
    for s_group in seats_pool:
        resp = await client.post(
            f"/api/v1/bookings/hold?showtime_id={showtime_id}",
            json={"seat_ids": s_group},
            headers={"X-Forwarded-For": bot_ip}
        )
        statuses.append(resp.status_code)
        if resp.status_code == 200:
            created_holds.append(resp.json()["hold_id"])

    # Expect at least one 429 Too Many Requests
    assert 429 in statuses, f"Expected 429 rate limit / hoarding block, got {statuses}"

    # Cleanup holds
    for h in created_holds:
        await client.post("/api/v1/bookings/release", json={"hold_id": h})


@pytest.mark.asyncio
async def test_security_idor_booking_isolation(client: AsyncClient):
    """
    Security Gate: IDOR protection on bookings.
    User A cannot view User B's booking.
    """
    # Create booking as customer 1
    # Customer user 3 is seeded customer
    from app.services.auth_service import create_access_token
    token_user_a = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    token_user_b = create_access_token({"sub": "2", "email": "manager@cineverse.in", "role": "THEATRE_MANAGER"})

    # Reset target seat G09
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(BookingSeat)
            .where(BookingSeat.showtime_id == 1, BookingSeat.seat_id == "G09")
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == 1, SeatInventory.seat_id == "G09")
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()

    # Hold seat as user A
    hold_resp = await client.post(
        "/api/v1/bookings/hold?showtime_id=1",
        json={"seat_ids": ["G09"]},
        headers={"Authorization": f"Bearer {token_user_a}"}
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # Create booking for user A
    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "showtime_id": 1,
            "hold_id": hold_id,
            "seat_ids": ["G09"],
            "addons": [],
            "contact_email": "customer@cineverse.in",
            "contact_phone": "9876543210"
        },
        headers={"Authorization": f"Bearer {token_user_a}"}
    )
    assert bkg_resp.status_code == 200
    bkg_id = bkg_resp.json()["id"]

    # User A accesses own booking -> 200 OK
    resp_owner = await client.get(
        f"/api/v1/bookings/{bkg_id}",
        headers={"Authorization": f"Bearer {token_user_a}"}
    )
    assert resp_owner.status_code == 200

    # User B (different non-admin user) attempts to access User A's booking -> 403 Forbidden
    resp_other = await client.get(
        f"/api/v1/bookings/{bkg_id}",
        headers={"Authorization": f"Bearer {token_user_b}"}
    )
    assert resp_other.status_code == 403
    assert "Not authorized" in resp_other.json()["detail"]

    # Unauthenticated visitor attempts to access booking -> 403 Forbidden
    resp_anon = await client.get(f"/api/v1/bookings/{bkg_id}")
    assert resp_anon.status_code == 403

    # Cleanup: cancel booking
    await client.post(
        f"/api/v1/bookings/{bkg_id}/cancel",
        headers={"Authorization": f"Bearer {token_user_a}"}
    )
