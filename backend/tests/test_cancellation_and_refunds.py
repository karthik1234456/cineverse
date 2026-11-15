import pytest
import uuid
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy import select

from app.models.booking import Booking, BookingSeat, BookingAddon, Ticket, BookingStatusEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.payment import Payment, PaymentStatusEnum, Refund
from app.models.audit import Notification
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_cancel_inside_window_success(client: AsyncClient, db_session):
    """
    Test 1: Cancelling inside the cancellation window succeeds.
    - Seats are released safely to AVAILABLE
    - Exact integer paise amounts are returned and recorded on Refund
    - In-app notification is created
    """
    # 1. Setup a confirmed booking with showtime 24 hours in the future
    now = datetime.utcnow()
    showtime_start = now + timedelta(hours=24)

    showtime = Showtime(
        movie_id=1,
        auditorium_id=1,
        cinema_id=1,
        start_time=showtime_start,
        end_time=showtime_start + timedelta(hours=2),
        format="IMAX 3D",
        language="English",
        cancellation_cutoff_minutes=120
    )
    db_session.add(showtime)
    await db_session.flush()

    # Create seat inventories
    seat1 = SeatInventory(
        showtime_id=showtime.id,
        seat_id="E01",
        category="Prime",
        price=400.0,
        status=SeatStatusEnum.BOOKED,
        booking_id=99901
    )
    seat2 = SeatInventory(
        showtime_id=showtime.id,
        seat_id="E02",
        category="Prime",
        price=400.0,
        status=SeatStatusEnum.BOOKED,
        booking_id=99901
    )
    db_session.add_all([seat1, seat2])

    booking = Booking(
        id=99901,
        booking_code="CV-CANCEL-01",
        user_id=3,
        showtime_id=showtime.id,
        status=BookingStatusEnum.CONFIRMED,
        total_ticket_amount=800.0,
        addons_amount=250.0,
        convenience_fee=60.0,
        gst_amount=10.8,
        discount_amount=0.0,
        final_total_amount=1120.8,
        contact_email="customer@cineverse.in",
        contact_phone="+919876543210"
    )
    db_session.add(booking)
    await db_session.flush()

    b_seat1 = BookingSeat(booking_id=booking.id, showtime_id=showtime.id, seat_id="E01", category="Prime", price=400.0)
    b_seat2 = BookingSeat(booking_id=booking.id, showtime_id=showtime.id, seat_id="E02", category="Prime", price=400.0)
    b_addon = BookingAddon(booking_id=booking.id, fnb_item_id=1, name="Caramel Popcorn", quantity=1, unit_price=250.0, total_price=250.0)
    ticket = Ticket(
        booking_id=booking.id,
        ticket_number="TKT-CANCEL-01",
        qr_data="QR-DATA-01",
        hmac_signature="sig-01",
        is_used=False
    )
    payment = Payment(
        booking_id=booking.id,
        razorpay_order_id="order_cancel_01",
        razorpay_payment_id="pay_cancel_01",
        amount=1120.8,
        status=PaymentStatusEnum.SUCCESS
    )
    db_session.add_all([b_seat1, b_seat2, b_addon, ticket, payment])
    await db_session.commit()

    # 2. Check cancellation quote endpoint
    user_token = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {user_token}"}

    quote_resp = await client.get(f"/api/v1/bookings/{booking.id}/cancellation-quote", headers=headers)
    assert quote_resp.status_code == 200
    q_data = quote_resp.json()
    assert q_data["can_cancel"] is True
    assert q_data["is_late"] is False
    assert q_data["is_used"] is False
    assert "breakdown" in q_data

    bd = q_data["breakdown"]
    # Ticket: 80000 paise. 25% fee = 20000 paise. Ticket refund = 60000 paise (75%).
    assert bd["ticket_amount_paise"] == 80000
    assert bd["ticket_refund_paise"] == 60000
    # Addon: 25000 paise (100% refund)
    assert bd["addons_amount_paise"] == 25000
    assert bd["addons_refund_paise"] == 25000
    # Fee and GST non-refundable
    assert bd["convenience_fee_refund_paise"] == 0
    assert bd["gst_refund_paise"] == 0
    # Total refund = 60000 + 25000 = 85000 paise (₹850.00)
    assert bd["total_refund_paise"] == 85000
    assert bd["total_paid_paise"] == 112080
    assert bd["total_refund_display"] == "₹850.00"

    # 3. Cancel the booking
    cancel_resp = await client.post(f"/api/v1/bookings/{booking.id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200
    c_data = cancel_resp.json()
    assert c_data["status"] == "CANCELLED"
    assert c_data["amount_paise"] == 85000
    assert c_data["refund_amount"] == 850.0
    assert len(c_data["timeline"]) >= 1
    assert c_data["timeline"][0]["status"] == "REQUESTED"

    # 4. Verify in DB: seats are AVAILABLE
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as verify_db:
        inv_res = await verify_db.execute(
            select(SeatInventory).where(SeatInventory.showtime_id == showtime.id, SeatInventory.seat_id.in_(["E01", "E02"]))
        )
        inv_seats = inv_res.scalars().all()
        for s in inv_seats:
            assert s.status == SeatStatusEnum.AVAILABLE
            assert s.booking_id is None
            assert s.hold_id is None

        # 5. Verify in DB: Refund record with integer paise
        ref_res = await verify_db.execute(select(Refund).where(Refund.booking_id == booking.id))
        db_refund = ref_res.scalars().first()
        assert db_refund is not None
        assert db_refund.amount_paise == 85000
        assert db_refund.status == "REQUESTED"
        assert db_refund.is_stuck is False

        # 6. Verify in DB: in-app notification created
        notif_res = await verify_db.execute(select(Notification).where(Notification.user_id == 3))
        notif = notif_res.scalars().first()
        assert notif is not None
        assert "Cancellation" in notif.title or "cancelled" in notif.message.lower()


@pytest.mark.asyncio
async def test_cancel_outside_window_late_rejected(client: AsyncClient, db_session):
    """
    Test 2: Late cancellation outside the window (cutoff passed) is rejected with 400.
    """
    now = datetime.utcnow()
    # Showtime starts in 30 minutes (cutoff is 120 minutes)
    showtime_start = now + timedelta(minutes=30)

    showtime = Showtime(
        movie_id=1,
        auditorium_id=1,
        cinema_id=1,
        start_time=showtime_start,
        end_time=showtime_start + timedelta(hours=2),
        format="Standard",
        cancellation_cutoff_minutes=120
    )
    db_session.add(showtime)
    await db_session.flush()

    booking = Booking(
        id=99902,
        booking_code="CV-LATE-02",
        user_id=3,
        showtime_id=showtime.id,
        status=BookingStatusEnum.CONFIRMED,
        total_ticket_amount=300.0,
        final_total_amount=300.0
    )
    db_session.add(booking)
    await db_session.commit()

    user_token = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {user_token}"}

    # Quote reports can_cancel = False, is_late = True
    quote_resp = await client.get(f"/api/v1/bookings/{booking.id}/cancellation-quote", headers=headers)
    assert quote_resp.status_code == 200
    q_data = quote_resp.json()
    assert q_data["can_cancel"] is False
    assert q_data["is_late"] is True

    # Cancel endpoint returns 400
    cancel_resp = await client.post(f"/api/v1/bookings/{booking.id}/cancel", headers=headers)
    assert cancel_resp.status_code == 400
    assert "Cancellation window closed" in cancel_resp.json()["detail"]


@pytest.mark.asyncio
async def test_cancel_scanned_ticket_rejected(client: AsyncClient, db_session):
    """
    Test 3: Already scanned/used tickets cannot be cancelled.
    """
    now = datetime.utcnow()
    showtime_start = now + timedelta(hours=24)

    showtime = Showtime(
        movie_id=1,
        auditorium_id=1,
        cinema_id=1,
        start_time=showtime_start,
        end_time=showtime_start + timedelta(hours=2),
        cancellation_cutoff_minutes=120
    )
    db_session.add(showtime)
    await db_session.flush()

    booking = Booking(
        id=99903,
        booking_code="CV-SCANNED-03",
        user_id=3,
        showtime_id=showtime.id,
        status=BookingStatusEnum.CONFIRMED,
        total_ticket_amount=500.0,
        final_total_amount=500.0
    )
    db_session.add(booking)
    await db_session.flush()

    ticket = Ticket(
        booking_id=booking.id,
        ticket_number="TKT-SCANNED-03",
        qr_data="QR-SCANNED",
        hmac_signature="sig-scanned",
        is_used=True,
        used_at=now
    )
    db_session.add(ticket)
    await db_session.commit()

    user_token = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {user_token}"}

    # Quote reports can_cancel = False, is_used = True
    quote_resp = await client.get(f"/api/v1/bookings/{booking.id}/cancellation-quote", headers=headers)
    assert quote_resp.status_code == 200
    assert quote_resp.json()["can_cancel"] is False
    assert quote_resp.json()["is_used"] is True

    # Cancel returns 400 Bad Request
    cancel_resp = await client.post(f"/api/v1/bookings/{booking.id}/cancel", headers=headers)
    assert cancel_resp.status_code == 400
    assert "already been scanned" in cancel_resp.json()["detail"]


@pytest.mark.asyncio
async def test_cancel_idor_unauthorized_user_denied(client: AsyncClient, db_session):
    """
    Test 4: Cancelling another user's booking is strictly denied (403 Forbidden).
    """
    now = datetime.utcnow()
    showtime_start = now + timedelta(hours=24)

    showtime = Showtime(
        movie_id=1,
        auditorium_id=1,
        cinema_id=1,
        start_time=showtime_start,
        end_time=showtime_start + timedelta(hours=2)
    )
    db_session.add(showtime)
    await db_session.flush()

    booking = Booking(
        id=99904,
        booking_code="CV-IDOR-04",
        user_id=3,  # Owned by User 3
        showtime_id=showtime.id,
        status=BookingStatusEnum.CONFIRMED,
        total_ticket_amount=400.0,
        final_total_amount=400.0
    )
    db_session.add(booking)
    await db_session.commit()

    # User 4 tries to cancel User 3's booking
    attacker_token = create_access_token({"sub": "4", "email": "other@cineverse.in", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {attacker_token}"}

    cancel_resp = await client.post(f"/api/v1/bookings/{booking.id}/cancel", headers=headers)
    assert cancel_resp.status_code == 403
    assert "Not authorized" in cancel_resp.json()["detail"]


@pytest.mark.asyncio
async def test_cancel_double_click_idempotency(client: AsyncClient, db_session):
    """
    Test 5: Double clicks / duplicate cancellation requests are completely harmless and idempotent.
    """
    now = datetime.utcnow()
    showtime_start = now + timedelta(hours=24)

    showtime = Showtime(
        movie_id=1,
        auditorium_id=1,
        cinema_id=1,
        start_time=showtime_start,
        end_time=showtime_start + timedelta(hours=2),
        cancellation_cutoff_minutes=120
    )
    db_session.add(showtime)
    await db_session.flush()

    booking = Booking(
        id=99905,
        booking_code="CV-DOUBLE-05",
        user_id=3,
        showtime_id=showtime.id,
        status=BookingStatusEnum.CONFIRMED,
        total_ticket_amount=400.0,
        final_total_amount=400.0
    )
    db_session.add(booking)
    await db_session.commit()

    user_token = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {user_token}"}

    # First click
    resp1 = await client.post(f"/api/v1/bookings/{booking.id}/cancel", headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "CANCELLED"

    # Immediate second click (duplicate submit)
    resp2 = await client.post(f"/api/v1/bookings/{booking.id}/cancel", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "CANCELLED"
    assert resp2.json().get("already_cancelled") is True

    # Verify only ONE refund record exists
    ref_res = await db_session.execute(select(Refund).where(Refund.booking_id == booking.id))
    refunds = ref_res.scalars().all()
    assert len(refunds) == 1


@pytest.mark.asyncio
async def test_seats_become_available_and_rebookable(client: AsyncClient, db_session):
    """
    Test 6: Cancelled seats immediately return to AVAILABLE and can be re-held/booked.
    """
    now = datetime.utcnow()
    showtime_start = now + timedelta(hours=24)

    showtime = Showtime(
        movie_id=1,
        auditorium_id=1,
        cinema_id=1,
        start_time=showtime_start,
        end_time=showtime_start + timedelta(hours=2),
        cancellation_cutoff_minutes=120
    )
    db_session.add(showtime)
    await db_session.flush()

    seat = SeatInventory(
        showtime_id=showtime.id,
        seat_id="B01",
        category="Prime",
        price=500.0,
        status=SeatStatusEnum.BOOKED,
        booking_id=99906
    )
    db_session.add(seat)

    booking = Booking(
        id=99906,
        booking_code="CV-REBOOK-06",
        user_id=3,
        showtime_id=showtime.id,
        status=BookingStatusEnum.CONFIRMED,
        total_ticket_amount=500.0,
        final_total_amount=500.0
    )
    db_session.add(booking)
    b_seat = BookingSeat(booking_id=booking.id, showtime_id=showtime.id, seat_id="B01", category="Prime", price=500.0)
    db_session.add(b_seat)
    await db_session.commit()

    user_token = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {user_token}"}

    # Cancel booking
    cancel_resp = await client.post(f"/api/v1/bookings/{booking.id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200

    # Another customer (User 4) holds and books the released seat
    user4_token = create_access_token({"sub": "4", "email": "other@cineverse.in", "role": "CUSTOMER"})
    headers4 = {"Authorization": f"Bearer {user4_token}"}

    hold_resp = await client.post(
        "/api/v1/bookings/hold",
        json={"showtime_id": showtime.id, "seat_ids": ["B01"]},
        headers=headers4
    )
    assert hold_resp.status_code == 200, hold_resp.text
    assert "B01" in hold_resp.json()["held_seats"]


@pytest.mark.asyncio
async def test_gateway_refund_webhook_duplicate_and_out_of_order(client: AsyncClient, db_session):
    """
    Test 7 & 8: Gateway refund webhook handles duplicates idempotently and respects monotonic state progression.
    """
    now = datetime.utcnow()
    refund = Refund(
        id=99907,
        booking_id=1,
        payment_id=1,
        refund_amount=300.0,
        amount_paise=30000,
        gateway_refund_id="rfnd_gw_test_99",
        status="REQUESTED",
        timeline=[{"status": "REQUESTED", "timestamp": now.isoformat(), "note": "Requested"}]
    )
    db_session.add(refund)
    await db_session.commit()

    # 1. Post webhook refund.processed -> transitions to REFUNDED
    wb_resp1 = await client.post("/api/v1/payments/webhook", json={
        "id": "evt_ref_processed_01",
        "event": "refund.processed",
        "payload": {
            "refund": {
                "entity": {
                    "id": "rfnd_gw_test_99",
                    "payment_id": "pay_test_01"
                }
            }
        }
    })
    assert wb_resp1.status_code == 200
    assert wb_resp1.json()["status"] == "success"

    # Verify status is REFUNDED
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as verify_db:
        r_check = (await verify_db.execute(select(Refund).where(Refund.id == refund.id))).scalars().first()
        assert r_check.status == "REFUNDED"

    # 2. Duplicate webhook event -> ignored
    wb_dup = await client.post("/api/v1/payments/webhook", json={
        "id": "evt_ref_processed_01",  # Same event ID
        "event": "refund.processed",
        "payload": {}
    })
    assert wb_dup.status_code == 200
    assert wb_dup.json()["status"] == "duplicate_event_ignored"

    # 3. Out-of-order delayed webhook arrives with refund.speed_processed / refund.created (PROCESSING)
    wb_out_of_order = await client.post("/api/v1/payments/webhook", json={
        "id": "evt_ref_created_late_02",
        "event": "refund.created",
        "payload": {
            "refund": {
                "entity": {
                    "id": "rfnd_gw_test_99",
                    "payment_id": "pay_test_01"
                }
            }
        }
    })
    assert wb_out_of_order.status_code == 200

    # Verify state did NOT regress back to PROCESSING! Status must remain REFUNDED!
    async with AsyncSessionLocal() as verify_db:
        r_final = (await verify_db.execute(select(Refund).where(Refund.id == refund.id))).scalars().first()
        assert r_final.status == "REFUNDED"


@pytest.mark.asyncio
async def test_admin_stuck_refunds_and_retry(client: AsyncClient, db_session):
    """
    Test 9: Admin can see stuck refunds and trigger manual retry.
    """
    now = datetime.utcnow()
    # Create a stuck/failed refund
    stuck_refund = Refund(
        id=99908,
        booking_id=1,
        payment_id=1,
        refund_amount=450.0,
        amount_paise=45000,
        gateway_refund_id="rfnd_stuck_01",
        status="FAILED",
        is_stuck=True,
        error_message="Gateway account balance insufficient",
        timeline=[{"status": "FAILED", "timestamp": now.isoformat(), "note": "Gateway failed"}]
    )
    db_session.add(stuck_refund)
    await db_session.commit()

    admin_token = create_access_token({"sub": "1", "email": "admin@cineverse.in", "role": "ADMIN"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin lists stuck refunds
    stuck_resp = await client.get("/api/v1/admin/refunds/stuck", headers=admin_headers)
    assert stuck_resp.status_code == 200
    stuck_list = stuck_resp.json()
    assert any(r["id"] == stuck_refund.id for r in stuck_list)
    target = next(r for r in stuck_list if r["id"] == stuck_refund.id)
    assert target["is_stuck"] is True
    assert target["amount_paise"] == 45000
    assert target["error_message"] == "Gateway account balance insufficient"

    # Admin retries the stuck refund
    retry_resp = await client.post(f"/api/v1/admin/refunds/{stuck_refund.id}/retry", headers=admin_headers)
    assert retry_resp.status_code == 200
    assert retry_resp.json()["new_status"] == "PROCESSING"

    # Verify in DB: is_stuck is cleared and status is PROCESSING
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as verify_db:
        r_res = (await verify_db.execute(select(Refund).where(Refund.id == stuck_refund.id))).scalars().first()
        assert r_res.is_stuck is False
        assert r_res.status == "PROCESSING"
        assert any("retried by administrator" in step["note"] for step in r_res.timeline)
