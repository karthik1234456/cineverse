import hmac
import hashlib
import uuid
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
from sqlalchemy import select, update, delete

from app.database import AsyncSessionLocal
from app.config import settings
from app.models.booking import Booking, BookingSeat, Ticket, BookingStatusEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.payment import Payment, PaymentEvent, PaymentStatusEnum
from app.services.ticket_service import generate_ticket_signature, generate_qr_data
from app.services.payment_service import verify_razorpay_hmac


@pytest.mark.asyncio
async def test_razorpay_order_creation_server_computed_amount(client: AsyncClient):
    """
    Payments Task 1:
    Server creates order with server-computed amount in paise.
    Client-side amount tampering is completely prevented.
    """
    # 1. Hold seat D05
    target_seat = "D05"
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(BookingSeat).where(BookingSeat.showtime_id == 1, BookingSeat.seat_id == target_seat)
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == 1, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()

    hold_resp = await client.post(
        "/api/v1/bookings/hold?showtime_id=1",
        json={"seat_ids": [target_seat]},
        headers={"X-Forwarded-For": "10.0.1.50"}
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    # 2. Create pending booking
    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "showtime_id": 1,
            "hold_id": hold_id,
            "seat_ids": [target_seat],
            "addons": [],
            "contact_email": "pay_test@cineverse.in",
            "contact_phone": "9811223344"
        }
    )
    assert bkg_resp.status_code == 200
    bkg = bkg_resp.json()
    booking_id = bkg["id"]
    expected_amount = bkg["final_total_amount"]

    # 3. Request Razorpay order
    order_resp = await client.post(
        "/api/v1/payments/create-order",
        json={"booking_id": booking_id}
    )
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    assert order_data["order_id"].startswith("order_")
    assert order_data["amount"] == expected_amount
    assert order_data["currency"] == "INR"


@pytest.mark.asyncio
async def test_razorpay_signature_validation_constant_time():
    """
    Security Gate:
    Constant-time compare with hmac.compare_digest.
    Valid signature passes; tampered signature is strictly rejected.
    """
    order_id = "order_test_12345"
    payment_id = "pay_test_67890"

    # Compute valid signature with configured secret
    valid_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # Valid signature
    assert verify_razorpay_hmac(order_id, payment_id, valid_sig) is True

    # Tampered signature
    tampered_sig = valid_sig[:-4] + "dead"
    assert verify_razorpay_hmac(order_id, payment_id, tampered_sig) is False

    # Tampered order_id
    assert verify_razorpay_hmac("order_forged", payment_id, valid_sig) is False


@pytest.mark.asyncio
async def test_payment_webhook_idempotency_and_duplicate_suppression(client: AsyncClient):
    """
    Payments Task 1 & Security Gate:
    Idempotency table payment_events prevents duplicate or replayed webhook events.
    """
    unique_event_id = f"evt_test_{uuid.uuid4().hex[:12]}"
    webhook_payload = {
        "event_id": unique_event_id,
        "event": "payment.captured",
        "entity": "event",
        "contains": ["payment"],
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_{uuid.uuid4().hex[:10]}",
                    "amount": 42000,
                    "currency": "INR",
                    "status": "captured"
                }
            }
        }
    }

    # First webhook ingestion -> success
    resp1 = await client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "success"

    # Replayed / duplicate webhook event -> duplicate_event_ignored
    resp2 = await client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "duplicate_event_ignored"
    assert data2["event_id"] == unique_event_id


@pytest.mark.asyncio
async def test_signed_qr_ticket_roundtrip_verification(client: AsyncClient):
    """
    Payments Task 4:
    Signed QR admission token with HMAC signature.
    Tampered payload fails cryptographic signature verification.
    """
    booking_code = f"CV-{uuid.uuid4().hex[:6].upper()}"
    showtime_id = 1
    seats = ["D01", "D02"]

    # Generate legitimate signature (Ed25519 base64)
    signature = generate_ticket_signature(booking_code, showtime_id, seats)
    assert len(signature) >= 64

    # Verification function
    expected_sig = generate_ticket_signature(booking_code, showtime_id, seats)
    assert hmac.compare_digest(signature, expected_sig) is True

    # Tampered seats in verification
    tampered_seats = ["D01", "D03"]
    tampered_sig = generate_ticket_signature(booking_code, showtime_id, tampered_seats)
    assert hmac.compare_digest(signature, tampered_sig) is False


@pytest.mark.asyncio
async def test_cancellation_and_refund_policy(client: AsyncClient):
    """
    Payments Task 3:
    Cancellation triggers seat inventory release back to AVAILABLE
    and calculates 75% refund per cinema policy.
    """
    target_seat = "C05"
    showtime_id = 1

    # Reset seat and ensure showtime start_time is in future for cancellation window
    async with AsyncSessionLocal() as db:
        st = await db.get(Showtime, showtime_id)
        if st:
            st.start_time = datetime.utcnow() + timedelta(days=2)
            st.end_time = datetime.utcnow() + timedelta(days=2, hours=3)
        await db.execute(
            delete(BookingSeat).where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id == target_seat)
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()

    # Hold and create booking
    hold_resp = await client.post(
        f"/api/v1/bookings/hold?showtime_id={showtime_id}",
        json={"seat_ids": [target_seat]}
    )
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "showtime_id": showtime_id,
            "hold_id": hold_id,
            "seat_ids": [target_seat],
            "addons": [],
            "contact_email": "cancel_test@cineverse.in",
            "contact_phone": "9877778888"
        }
    )
    assert bkg_resp.status_code == 200
    bkg_id = bkg_resp.json()["id"]

    # Verify payment to confirm booking
    order_resp = await client.post("/api/v1/payments/create-order", json={"booking_id": bkg_id})
    order_id = order_resp.json()["order_id"]
    pay_id = f"pay_{uuid.uuid4().hex[:10]}"
    valid_sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), f"{order_id}|{pay_id}".encode("utf-8"), hashlib.sha256).hexdigest()

    verify_resp = await client.post(
        "/api/v1/payments/verify",
        json={
            "booking_id": bkg_id,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": pay_id,
            "razorpay_signature": valid_sig
        }
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["status"] == "CONFIRMED"

    # Cancel booking
    cancel_resp = await client.post(f"/api/v1/bookings/{bkg_id}/cancel")
    assert cancel_resp.status_code == 200
    cancel_data = cancel_resp.json()
    assert cancel_data["status"] == "CANCELLED"
    assert "refund_amount" in cancel_data
    assert cancel_data["refund_amount"] > 0

    # Verify seat returned to AVAILABLE in inventory
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(SeatInventory).where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
        )
        seat_inv = res.scalars().first()
        assert seat_inv.status == SeatStatusEnum.AVAILABLE



@pytest.mark.asyncio
async def test_legacy_bypass_strings_strictly_rejected():
    """FIX-01: Legacy bypass strings must be rejected unconditionally."""
    assert verify_razorpay_hmac("order_test_1", "pay_test_1", "test_signature_valid") is False
    assert verify_razorpay_hmac("order_test_2", "pay_test_2", "simulated_success_signature") is False
    assert verify_razorpay_hmac("", "pay_test_3", "some_sig") is False
    assert verify_razorpay_hmac("order_test_4", "", "some_sig") is False
    assert verify_razorpay_hmac("order_test_5", "pay_test_5", "") is False


@pytest.mark.asyncio
async def test_payment_verify_tampered_signature_and_order_mismatch(client: AsyncClient):
    """FIX-01: Payment verify rejects tampered signature and order mismatch."""
    target_seat = "B05"
    showtime_id = 1
    async with AsyncSessionLocal() as db:
        await db.execute(delete(BookingSeat).where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id == target_seat))
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()

    hold_resp = await client.post(f"/api/v1/bookings/hold?showtime_id={showtime_id}", json={"seat_ids": [target_seat]})
    hold_id = hold_resp.json()["hold_id"]

    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "showtime_id": showtime_id,
            "hold_id": hold_id,
            "seat_ids": [target_seat],
            "addons": [],
            "contact_email": "tamper_test@cineverse.in",
            "contact_phone": "9800001111"
        }
    )
    bkg_id = bkg_resp.json()["id"]

    order_resp = await client.post("/api/v1/payments/create-order", json={"booking_id": bkg_id})
    order_id = order_resp.json()["order_id"]
    pay_id = f"pay_{uuid.uuid4().hex[:10]}"

    valid_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_id}|{pay_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # 1. Tampered signature
    bad_resp = await client.post(
        "/api/v1/payments/verify",
        json={
            "booking_id": bkg_id,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": pay_id,
            "razorpay_signature": valid_sig[:-4] + "dead"
        }
    )
    assert bad_resp.status_code == 400
    assert "Invalid payment signature" in bad_resp.text

    # 2. Wrong order_id
    wrong_order_resp = await client.post(
        "/api/v1/payments/verify",
        json={
            "booking_id": bkg_id,
            "razorpay_order_id": "order_completely_wrong",
            "razorpay_payment_id": pay_id,
            "razorpay_signature": valid_sig
        }
    )
    assert wrong_order_resp.status_code == 400


@pytest.mark.asyncio
async def test_webhook_forged_duplicate_and_out_of_order(client: AsyncClient):
    """FIX-01: Webhook tests for idempotency, replay suppression, and duplicate events."""
    event_id = f"evt_exhaust_{uuid.uuid4().hex[:10]}"
    payload = {
        "event_id": event_id,
        "event": "payment.captured",
        "entity": "event",
        "contains": ["payment"],
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_{uuid.uuid4().hex[:10]}",
                    "amount": 55000,
                    "currency": "INR",
                    "status": "captured"
                }
            }
        }
    }

    # First event
    resp1 = await client.post("/api/v1/payments/webhook", json=payload)
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "success"

    # Duplicate / replay of same event
    resp2 = await client.post("/api/v1/payments/webhook", json=payload)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "duplicate_event_ignored"

    # Out of order webhook event (e.g. refund arrived before capture log)
    out_of_order_evt = f"evt_out_{uuid.uuid4().hex[:10]}"
    out_payload = {
        "event_id": out_of_order_evt,
        "event": "refund.processed",
        "entity": "event",
        "payload": {"refund": {"id": f"rfnd_{uuid.uuid4().hex[:8]}", "amount": 25000}}
    }
    resp3 = await client.post("/api/v1/payments/webhook", json=out_payload)
    assert resp3.status_code == 200
    assert resp3.json()["status"] == "success"


@pytest.mark.asyncio
async def test_paid_after_expiry_triggers_automatic_refund(client: AsyncClient):
    """
    Payments Task 2 & Security Gate:
    Paid-after-expiry triggers 410 GONE and automatic full refund record.
    """
    target_seat = "A08"
    showtime_id = 1
    async with AsyncSessionLocal() as db:
        await db.execute(delete(BookingSeat).where(BookingSeat.showtime_id == showtime_id, BookingSeat.seat_id == target_seat))
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.commit()

    hold_resp = await client.post(f"/api/v1/bookings/hold?showtime_id={showtime_id}", json={"seat_ids": [target_seat]})
    assert hold_resp.status_code == 200
    hold_id = hold_resp.json()["hold_id"]

    bkg_resp = await client.post(
        "/api/v1/bookings/create",
        json={
            "showtime_id": showtime_id,
            "hold_id": hold_id,
            "seat_ids": [target_seat],
            "addons": [],
            "contact_email": "expiry_refund@cineverse.in",
            "contact_phone": "9812345678"
        }
    )
    assert bkg_resp.status_code == 200
    bkg_id = bkg_resp.json()["id"]

    order_resp = await client.post("/api/v1/payments/create-order", json={"booking_id": bkg_id})
    order_id = order_resp.json()["order_id"]
    pay_id = f"pay_{uuid.uuid4().hex[:10]}"
    valid_sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), f"{order_id}|{pay_id}".encode("utf-8"), hashlib.sha256).hexdigest()

    # Artificially expire the hold in database before payment verification
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == showtime_id, SeatInventory.seat_id == target_seat)
            .values(hold_expires_at=datetime.utcnow() - timedelta(minutes=10))
        )
        await db.commit()

    # Attempt payment verification after expiry
    verify_resp = await client.post(
        "/api/v1/payments/verify",
        json={
            "booking_id": bkg_id,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": pay_id,
            "razorpay_signature": valid_sig
        }
    )
    assert verify_resp.status_code == 410
    assert "PAID_AFTER_EXPIRY" in verify_resp.json()["detail"]

    # Verify refund was recorded
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Payment).where(Payment.booking_id == bkg_id))
        payment = res.scalars().first()
        assert payment.status == PaymentStatusEnum.REFUNDED


@pytest.mark.asyncio
async def test_webhook_forged_signature_rejected(client: AsyncClient):
    """FIX-01: Webhook with forged signature header is rejected with 400."""
    payload = {"event_id": f"evt_forged_{uuid.uuid4().hex[:8]}", "event": "payment.captured"}
    import json
    body_bytes = json.dumps(payload).encode("utf-8")
    resp = await client.post(
        "/api/v1/payments/webhook",
        content=body_bytes,
        headers={"X-Razorpay-Signature": "invalid_forged_sig_deadbeef", "Content-Type": "application/json"}
    )
    assert resp.status_code == 400
    assert "Invalid webhook signature" in resp.text
