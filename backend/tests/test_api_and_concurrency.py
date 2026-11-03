import pytest
import asyncio
import uuid
import hmac
import hashlib
from app.config import settings
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.showtime import Showtime


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["features"]["3d_auditorium"] is True


@pytest.mark.asyncio
async def test_cities_and_movies_listing(client: AsyncClient):
    # Cities
    cities_resp = await client.get("/api/v1/cities/")
    assert cities_resp.status_code == 200
    cities = cities_resp.json()
    assert len(cities) >= 7
    city_names = [c["name"] for c in cities]
    assert "Bengaluru" in city_names
    assert "Mumbai" in city_names

    # Movies
    movies_resp = await client.get("/api/v1/movies/")
    assert movies_resp.status_code == 200
    movies = movies_resp.json()
    assert len(movies) >= 12

    # Movie details
    m = movies[0]
    detail_resp = await client.get(f"/api/v1/movies/{m['slug']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["title"] == m["title"]
    assert len(detail["cast_members"]) > 0


@pytest.mark.asyncio
async def test_showtimes_and_seats_inventory(client: AsyncClient):
    movies_resp = await client.get("/api/v1/movies/")
    movie_id = movies_resp.json()[0]["id"]

    showtimes_resp = await client.get(f"/api/v1/movies/{movie_id}/showtimes")
    assert showtimes_resp.status_code == 200
    grouped = showtimes_resp.json()
    assert len(grouped) > 0

    first_st = grouped[0]["showtimes"][0]
    st_id = first_st["id"]

    # Fetch seat inventory for 3D auditorium
    seats_resp = await client.get(f"/api/v1/showtimes/{st_id}/seats")
    assert seats_resp.status_code == 200
    seats_data = seats_resp.json()
    assert seats_data["showtime_id"] == st_id
    assert len(seats_data["seats"]) == 100

    # Verify 3D metadata is present
    seat_a01 = next(s for s in seats_data["seats"] if s["seat_id"] == "A01")
    assert seat_a01["node_name"] == "seat_A_01"
    assert "distance_to_screen" in seat_a01
    assert "vertical_angle_deg" in seat_a01


@pytest.mark.asyncio
async def test_seat_hold_concurrency_race_condition(client: AsyncClient):
    """
    RACE CONDITION TEST:
    5 concurrent clients attempt to hold the EXACT SAME SEAT (B05) simultaneously.
    Guarantee: Exactly 1 client must succeed (200 OK), and 4 must fail with 409 Conflict.
    """
    # Find a showtime with available B05
    movies_resp = await client.get("/api/v1/movies/")
    movie_id = movies_resp.json()[0]["id"]
    showtimes_resp = await client.get(f"/api/v1/movies/{movie_id}/showtimes")
    st_id = showtimes_resp.json()[0]["showtimes"][0]["id"]

    # Pick an available seat dynamically
    seats_resp = await client.get(f"/api/v1/showtimes/{st_id}/seats")
    assert seats_resp.status_code == 200
    avail_seats = [s["seat_id"] for s in seats_resp.json()["seats"] if s["status"] == "AVAILABLE"]
    assert len(avail_seats) > 0, "No available seats found for race condition test"
    target_seat = avail_seats[0]

    async def attempt_hold(client_id: int):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            return await c.post(
                f"/api/v1/bookings/hold?showtime_id={st_id}",
                json={"seat_ids": [target_seat]}
            )

    # Fire 5 simultaneous requests
    responses = await asyncio.gather(*[attempt_hold(i) for i in range(5)])

    success_count = sum(1 for r in responses if r.status_code == 200)
    conflict_count = sum(1 for r in responses if r.status_code == 409)

    assert success_count == 1, f"Expected exactly 1 hold success, got {success_count}"
    assert conflict_count == 4, f"Expected 4 conflict responses, got {conflict_count}"

    # Extract winning hold
    winning_resp = next(r for r in responses if r.status_code == 200).json()
    hold_id = winning_resp["hold_id"]

    # Release held seat to restore state
    rel_resp = await client.post("/api/v1/bookings/release", json={"hold_id": hold_id})
    assert rel_resp.status_code == 200
    assert target_seat in rel_resp.json()["released"]


@pytest.mark.asyncio
async def test_pricing_tax_and_coupon_math(client: AsyncClient):
    # Test valid active coupon
    active_resp = await client.get("/api/v1/coupons/active")
    assert active_resp.status_code == 200
    active_coupons = active_resp.json()
    assert len(active_coupons) >= 3

    # Validate coupon calculation with a fresh code or FIRSTSHOW
    val_resp = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "FIRSTSHOW", "order_amount": 500.0}
    )
    assert val_resp.status_code == 200
    res = val_resp.json()
    assert res["valid"] is True
    # 20% of 500 = 100
    assert res["discount_amount"] == 100.0

    # Flat coupon validation
    flat_resp = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "BLOCKBUSTER100", "order_amount": 600.0}
    )
    assert flat_resp.status_code == 200
    f_res = flat_resp.json()
    assert f_res["valid"] is True
    assert f_res["discount_amount"] == 100.0


@pytest.mark.asyncio
async def test_full_booking_payment_and_qr_ticket_lifecycle(client: AsyncClient):
    """
    End-to-End Booking Lifecycle:
    1. Select showtime
    2. Dynamically pick 2 AVAILABLE seats
    3. Hold seats
    4. Create booking with F&B addon + coupon
    5. Verify server-created Razorpay order
    6. Verify HMAC payment signature
    7. Ensure status becomes CONFIRMED with verifiable QR ticket
    8. Cancel booking and verify refund
    """
    # 1. Showtime
    movies_resp = await client.get("/api/v1/movies/")
    movie_id = movies_resp.json()[0]["id"]
    showtimes_resp = await client.get(f"/api/v1/movies/{movie_id}/showtimes")
    st_id = showtimes_resp.json()[0]["showtimes"][0]["id"]

    # Ensure showtime start_time is in the future for cancellation test window
    async with AsyncSessionLocal() as db:
        st = await db.get(Showtime, st_id)
        if st:
            st.start_time = datetime.utcnow() + timedelta(days=2)
            st.end_time = datetime.utcnow() + timedelta(days=2, hours=3)
            await db.commit()

    # Fetch available seats dynamically from Row D
    seats_resp = await client.get(f"/api/v1/showtimes/{st_id}/seats")
    avail_seats = [s["seat_id"] for s in seats_resp.json()["seats"] if s["status"] == "AVAILABLE"]
    target_seats = [s for s in avail_seats if s.startswith("D")][:2]
    assert len(target_seats) == 2, "Need at least 2 available seats in Row D for test"

    # 2. Hold target seats
    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={st_id}",
        json={"seat_ids": target_seats}
    )
    assert hold_resp.status_code == 200
    hold_data = hold_resp.json()
    hold_id = hold_data["hold_id"]

    # 3. Fetch addons
    addons_resp = await client.get("/api/v1/addons/")
    assert addons_resp.status_code == 200
    addons = addons_resp.json()
    fnb_id = addons[0]["id"]

    # 4. Create Booking
    bkg_req = {
        "showtime_id": st_id,
        "hold_id": hold_id,
        "seat_ids": target_seats,
        "addons": [{"fnb_item_id": fnb_id, "quantity": 1}],
        "coupon_code": "FIRSTSHOW",
        "contact_email": f"e2e_tester_{uuid.uuid4().hex[:6]}@cineverse.in",
        "contact_phone": f"9{uuid.uuid4().int % 1000000000:09d}"
    }
    bkg_resp = await client.post("/api/v1/bookings/create", json=bkg_req)
    assert bkg_resp.status_code == 200
    booking = bkg_resp.json()
    booking_id = booking["id"]
    assert booking["status"] == "PENDING"
    assert len(booking["seats"]) == 2
    assert len(booking["addons"]) == 1
    assert booking["final_total_amount"] > 0

    # 5. Create Razorpay order
    order_resp = await client.post("/api/v1/payments/create-order", json={"booking_id": booking_id})
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    order_id = order_data["order_id"]

    # 6. Verify Payment (using computed HMAC signature)
    test_pay_id = f"pay_test_{uuid.uuid4().hex[:12]}"
    valid_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_id}|{test_pay_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    verify_resp = await client.post(
        "/api/v1/payments/verify",
        json={
            "booking_id": booking_id,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": test_pay_id,
            "razorpay_signature": valid_sig
        }
    )
    assert verify_resp.status_code == 200
    confirmed = verify_resp.json()
    assert confirmed["status"] == "CONFIRMED"
    assert confirmed["ticket"] is not None
    assert confirmed["ticket"]["qr_code_url"].startswith("data:image/png;base64,")

    # 7. Check ticket QR endpoint
    qr_resp = await client.get(f"/api/v1/tickets/{booking_id}/qr")
    assert qr_resp.status_code == 200
    qr_data = qr_resp.json()
    assert qr_data["ticket_number"].startswith("TKT-")

    # 8. Webhook idempotency test
    webhook_payload = {
        "event_id": f"evt_unique_{booking_id}",
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_test_987654321"}}}
    }
    wh_1 = await client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert wh_1.status_code == 200
    assert wh_1.json()["status"] == "success"

    # Duplicate webhook should be recognized as duplicate
    wh_2 = await client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert wh_2.status_code == 200
    assert wh_2.json()["status"] == "duplicate_event_ignored"

    # 9. Cancellation & Refund
    cancel_resp = await client.post(f"/api/v1/bookings/{booking_id}/cancel")
    assert cancel_resp.status_code == 200
    cancel_data = cancel_resp.json()
    assert cancel_data["status"] == "CANCELLED"
    assert cancel_data["refund_amount"] > 0
