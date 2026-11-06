import pytest
import uuid
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy import select, update, delete

from app.database import AsyncSessionLocal
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingSeat, FnbItem
from app.models.promotion import CouponRedemption
from app.models.auth import User
from app.services.hold_service import reset_hold_tracking


@pytest.fixture(autouse=True)
def reset_holds():
    reset_hold_tracking()
    yield
    reset_hold_tracking()


async def get_auth_token(client: AsyncClient, email: str = "patron@example.com", password: str = "Patron@123") -> str:
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200, f"Login failed for {email}"
    return login_resp.json()["access_token"]


@pytest.mark.asyncio
async def test_server_quote_locked_calculation_and_guarantee(client: AsyncClient):
    """
    1. Authenticated user holds seats.
    2. GET /api/v1/bookings/hold/{hold_id} returns exact server locked quote.
    3. Verifies 'The price shown at checkout is final'.
    4. Verifies display amounts are formatted as integer ₹ without decimals.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    showtime_id = 1
    seats = ["D05", "D06"]

    # Reset seats
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(BookingSeat).where(
                BookingSeat.showtime_id == showtime_id,
                BookingSeat.seat_id.in_(seats)
            )
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None, price=380.0)
        )
        await db.commit()

    # Hold seats while logged in
    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers=headers
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # Fetch locked quote
    quote_resp = await client.get(f"/api/v1/bookings/hold/{hold_id}", headers=headers)
    assert quote_resp.status_code == 200
    quote = quote_resp.json()

    assert quote["hold_id"] == hold_id
    assert quote["showtime_id"] == showtime_id
    assert quote["price_lock_guarantee"] == "The price shown at checkout is final"
    assert len(quote["held_seats"]) == 2

    # Check that display amounts have no decimals
    assert "." not in quote["ticket_subtotal_display"]
    assert quote["ticket_subtotal_display"].startswith("₹")
    assert quote["final_total_display"].startswith("₹")
    assert "." not in quote["final_total_display"]

    # Server price verification: seats D05, D06 are Prime (₹380 each)
    expected_ticket_subtotal = 760.0
    expected_convenience_fee = 70.0
    expected_gst = 12.60
    expected_final_total = 842.60

    assert quote["ticket_subtotal"] == expected_ticket_subtotal
    assert quote["convenience_fee"] == expected_convenience_fee
    assert quote["gst_amount"] == expected_gst
    assert quote["final_total"] == expected_final_total
    assert quote["final_total_display"] == f"₹{int(round(expected_final_total))}"


@pytest.mark.asyncio
async def test_idor_protection_another_user_hold_refused(client: AsyncClient):
    """
    IDOR Security Probe:
    User A holds seats.
    User B attempts to fetch User A's hold quote or book it -> Must return 403 Forbidden.
    """
    token_a = await get_auth_token(client, email="patron@example.com", password="Patron@123")
    token_b = await get_auth_token(client, email="manager@cineverse.in", password="Manager@123")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    showtime_id = 1
    seats = ["B03"]

    # Reset seat
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None, price=380.0)
        )
        await db.commit()

    # User A holds seat
    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers=headers_a
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # User B tries to view User A's hold quote -> 403
    quote_resp_b = await client.get(f"/api/v1/bookings/hold/{hold_id}", headers=headers_b)
    assert quote_resp_b.status_code == 403
    assert "Not authorized" in quote_resp_b.json()["detail"]

    # User B tries to book User A's hold -> 403
    bkg_resp_b = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "contact_email": "manager@cineverse.in",
            "contact_phone": "9876543211"
        },
        headers=headers_b
    )
    assert bkg_resp_b.status_code == 403
    assert "Not authorized" in bkg_resp_b.json()["detail"]


@pytest.mark.asyncio
async def test_unauthenticated_hold_quote_requires_login(client: AsyncClient):
    """
    Requirement 2: Login required to view hold quote.
    Calling GET /api/v1/bookings/hold/{hold_id} without auth header returns 401.
    """
    quote_resp = await client.get("/api/v1/bookings/hold/hold_fake123")
    assert quote_resp.status_code == 401


@pytest.mark.asyncio
async def test_expired_hold_refused_with_friendly_message(client: AsyncClient):
    """
    Expired hold probe:
    When hold_expires_at is in the past, viewing quote or creating booking must return 404/400.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    showtime_id = 1
    seats = ["B04"]

    # Reset seat
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None, price=380.0)
        )
        await db.commit()

    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers=headers
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # Artificially expire the hold
    past_time = datetime.utcnow() - timedelta(minutes=15)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.hold_id == hold_id)
            .values(hold_expires_at=past_time)
        )
        await db.commit()

    # Get quote -> 404
    quote_resp = await client.get(f"/api/v1/bookings/hold/{hold_id}", headers=headers)
    assert quote_resp.status_code == 404
    assert "expired" in quote_resp.json()["detail"].lower()

    # Attempt booking -> 400
    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "contact_email": "patron@example.com",
            "contact_phone": "9876543212"
        },
        headers=headers
    )
    assert bkg_resp.status_code == 400
    assert "expired" in bkg_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_replay_old_hold_id_refused(client: AsyncClient):
    """
    Replay attack probe:
    Once a hold is converted to a booking, calling create_booking again with the same hold_id
    must fail safely with 400.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    showtime_id = 1
    seats = ["B05"]

    # Reset seat and coupon redemptions
    async with AsyncSessionLocal() as db:
        await db.execute(delete(CouponRedemption))
        await db.execute(
            delete(BookingSeat).where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id.in_(seats))
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None, price=380.0)
        )
        await db.commit()

    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers=headers
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # Booking 1 -> Succeeds
    bkg_1 = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "contact_email": "patron@example.com",
            "contact_phone": "9876543212"
        },
        headers=headers
    )
    assert bkg_1.status_code == 200

    # Replay: Booking 2 with same hold_id -> Refused
    bkg_2 = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "contact_email": "patron@example.com",
            "contact_phone": "9876543212"
        },
        headers=headers
    )
    assert bkg_2.status_code == 400
    assert "already been used or converted" in bkg_2.json()["detail"]


@pytest.mark.asyncio
async def test_request_body_tampering_seat_and_showtime_mismatch_refused(client: AsyncClient):
    """
    Request body tampering probe:
    Client tries to pass seat IDs or showtime ID that don't match the locked hold reservation.
    Must be rejected with 400.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    showtime_id = 1
    seats = ["B06"]

    # Reset seat
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None, price=380.0)
        )
        await db.commit()

    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers=headers
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # Tamper with showtime ID
    tampered_st = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "showtime_id": 999,
            "contact_email": "patron@example.com",
            "contact_phone": "9876543212"
        },
        headers=headers
    )
    assert tampered_st.status_code == 400
    assert "Showtime ID does not match" in tampered_st.json()["detail"]

    # Tamper with seat IDs (trying to claim premier seat J10 instead of B06)
    tampered_seats = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "seat_ids": ["J10"],
            "contact_email": "patron@example.com",
            "contact_phone": "9876543212"
        },
        headers=headers
    )
    assert tampered_seats.status_code == 400
    assert "Seat IDs do not match" in tampered_seats.json()["detail"]


@pytest.mark.asyncio
async def test_addons_and_coupon_attached_to_server_quote(client: AsyncClient):
    """
    Tests server-side addons and coupon attachment to hold.
    Updates quote on server; booking creation derives exact totals from server quote.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    showtime_id = 1
    seats = ["D07"]

    # Reset seat and coupon redemptions
    async with AsyncSessionLocal() as db:
        await db.execute(delete(CouponRedemption))
        await db.execute(
            delete(BookingSeat).where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id.in_(seats))
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None, price=380.0)
        )
        await db.commit()

    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers=headers
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # Attach addon: F&B item 1 (Large Popcorn & Pepsi Combo, ₹320, qty: 2)
    addon_resp = await client.post(
        f"/api/v1/bookings/hold/{hold_id}/addons",
        json={"addons": [{"fnb_item_id": 1, "quantity": 2}]},
        headers=headers
    )
    assert addon_resp.status_code == 200
    addon_quote = addon_resp.json()
    assert addon_quote["addons_subtotal"] == 640.0
    assert len(addon_quote["addons"]) == 1

    # Attach coupon: CINEVERSE50
    coupon_resp = await client.post(
        f"/api/v1/bookings/hold/{hold_id}/coupon",
        json={"code": "CINEVERSE50"},
        headers=headers
    )
    assert coupon_resp.status_code == 200
    coupon_quote = coupon_resp.json()
    assert coupon_quote["applied_coupon"] is not None
    assert coupon_quote["discount_amount"] > 0

    # Create booking with only hold_id
    booking_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "contact_email": "patron@example.com",
            "contact_phone": "9876543212"
        },
        headers=headers
    )
    assert booking_resp.status_code == 200
    booking = booking_resp.json()
    assert booking["addons_amount"] == 640.0
    assert booking["discount_amount"] == coupon_quote["discount_amount"]
    assert booking["final_total_amount"] == coupon_quote["final_total"]


@pytest.mark.asyncio
async def test_payment_order_creation_uses_only_server_quote(client: AsyncClient):
    """
    Payment order creation uses only the server quote.
    Tampering with amounts in the order creation payload is ignored;
    Razorpay order amount strictly matches booking.final_total_amount.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    showtime_id = 1
    seats = ["D08"]

    # Reset seat and coupon redemptions
    async with AsyncSessionLocal() as db:
        await db.execute(delete(CouponRedemption))
        await db.execute(
            delete(BookingSeat).where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id.in_(seats))
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id.in_(seats))
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None, price=380.0)
        )
        await db.commit()

    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": seats},
        headers=headers
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # Create booking
    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "hold_id": hold_id,
            "contact_email": "patron@example.com",
            "contact_phone": "9876543212"
        },
        headers=headers
    )
    assert bkg_resp.status_code == 200
    booking_id = bkg_resp.json()["id"]
    server_final_total = bkg_resp.json()["final_total_amount"]

    # Client tries to send a tampered order request with amount = 1.0 rupee
    order_resp = await client.post(
        "/api/v1/payments/create-order",
        json={
            "booking_id": booking_id,
            "amount": 1.0  # Injected tamper attempt
        },
        headers=headers
    )
    assert order_resp.status_code == 200
    order_data = order_resp.json()

    # Razorpay order amount strictly matches server quote
    assert order_data["amount"] == server_final_total
    assert order_data["amount"] != 1.0

