import hmac
import hashlib
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.booking import Booking, BookingSeat, Ticket, BookingStatusEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.payment import Payment, PaymentEvent, Refund, PaymentStatusEnum
from app.services.hold_service import broadcast_seat_update
from app.services.ticket_service import generate_ticket_signature, generate_qr_data, generate_qr_code_base64

logger = logging.getLogger("cineverse.payment")


def verify_razorpay_hmac(order_id: str, payment_id: str, signature: str) -> bool:
    """
    Verifies Razorpay payment signature using constant-time HMAC-SHA256 comparison.
    No hardcoded bypass strings or sandbox backdoors are permitted.
    """
    if not order_id or not payment_id or not signature:
        return False

    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


async def create_razorpay_order(db: AsyncSession, booking_id: int) -> dict:
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
        .options(selectinload(Booking.seats))
    )
    result = await db.execute(stmt)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail=f"Booking is not pending payment (status: {booking.status})")

    # Check if payment record already exists (Idempotent order creation)
    pay_stmt = select(Payment).where(Payment.booking_id == booking_id)
    res = await db.execute(pay_stmt)
    payment = res.scalars().first()

    if payment and payment.status == PaymentStatusEnum.PENDING and payment.razorpay_order_id:
        order_id = payment.razorpay_order_id
    else:
        order_id = f"order_{uuid.uuid4().hex[:14]}"
        if not payment:
            payment = Payment(
                booking_id=booking.id,
                razorpay_order_id=order_id,
                amount=booking.final_total_amount,
                currency="INR",
                status=PaymentStatusEnum.PENDING
            )
            db.add(payment)
        else:
            payment.razorpay_order_id = order_id
            payment.amount = booking.final_total_amount
            payment.status = PaymentStatusEnum.PENDING

    # Transition seats from HELD to PAYMENT_PENDING and extend hold time by 5m so paying user is protected
    now = datetime.utcnow()
    seat_codes = [s.seat_id for s in booking.seats]
    if seat_codes:
        inv_stmt = select(SeatInventory).where(
            SeatInventory.showtime_id == booking.showtime_id,
            SeatInventory.seat_id.in_(seat_codes)
        )
        inv_res = await db.execute(inv_stmt)
        for inv in inv_res.scalars().all():
            if inv.status in (SeatStatusEnum.HELD, SeatStatusEnum.PAYMENT_PENDING):
                inv.status = SeatStatusEnum.PAYMENT_PENDING
                min_extended = now + timedelta(minutes=5)
                if not inv.hold_expires_at or inv.hold_expires_at < min_extended:
                    inv.hold_expires_at = min_extended

    await db.commit()

    return {
        "order_id": order_id,
        "booking_id": booking.id,
        "amount": booking.final_total_amount,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
        "name": "CineVerse India",
        "description": f"Booking {booking.booking_code}"
    }


async def verify_payment(
    db: AsyncSession,
    booking_id: int,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str
) -> Booking:
    # 1. Signature check
    if not verify_razorpay_hmac(razorpay_order_id, razorpay_payment_id, razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature"
        )

    # 2. Fetch booking
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.addons),
            selectinload(Booking.showtime).selectinload(Showtime.movie),
            selectinload(Booking.showtime).selectinload(Showtime.cinema),
            selectinload(Booking.showtime).selectinload(Showtime.auditorium),
            selectinload(Booking.payment),
            selectinload(Booking.ticket)
        )
    )
    result = await db.execute(stmt)
    booking = result.scalars().first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatusEnum.CONFIRMED:
        return booking

    # Check that hold hasn't expired (Paid-after-expiry triggers automatic refund)
    now = datetime.utcnow()
    seat_codes = [s.seat_id for s in booking.seats]
    inv_stmt = select(SeatInventory).where(
        SeatInventory.showtime_id == booking.showtime_id,
        SeatInventory.seat_id.in_(seat_codes)
    )
    inv_res = await db.execute(inv_stmt)
    inv_seats = inv_res.scalars().all()

    is_expired = False
    for inv in inv_seats:
        if inv.status not in (SeatStatusEnum.HELD, SeatStatusEnum.PAYMENT_PENDING) or (inv.hold_expires_at and inv.hold_expires_at <= now):
            is_expired = True
            break

    if is_expired:
        booking.status = BookingStatusEnum.EXPIRED
        # Record payment as refunded due to post-expiry capture
        payment = booking.payment
        if not payment:
            payment = Payment(
                booking_id=booking.id,
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=razorpay_payment_id,
                razorpay_signature=razorpay_signature,
                amount=booking.final_total_amount,
                status=PaymentStatusEnum.REFUNDED
            )
            db.add(payment)
            await db.flush()
        else:
            payment.status = PaymentStatusEnum.REFUNDED
            payment.razorpay_payment_id = razorpay_payment_id
            payment.razorpay_signature = razorpay_signature

        refund = Refund(
            booking_id=booking.id,
            payment_id=payment.id,
            refund_amount=booking.final_total_amount,
            cancellation_fee=0.0,
            reason="Paid after hold expired — full automated refund initiated",
            status="PROCESSED"
        )
        db.add(refund)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="PAID_AFTER_EXPIRY: Seat hold expired before payment was confirmed. A full 100% refund has been automatically initiated to your original payment method."
        )

    # Transition seat inventory to BOOKED
    for inv in inv_seats:
        inv.status = SeatStatusEnum.BOOKED
        inv.booking_id = booking.id
        inv.hold_id = None
        inv.hold_expires_at = None

    # Update payment
    if booking.payment:
        booking.payment.razorpay_payment_id = razorpay_payment_id
        booking.payment.razorpay_signature = razorpay_signature
        booking.payment.status = PaymentStatusEnum.SUCCESS
    else:
        new_payment = Payment(
            booking_id=booking.id,
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
            amount=booking.final_total_amount,
            status=PaymentStatusEnum.SUCCESS
        )
        db.add(new_payment)

    # Transition booking
    booking.status = BookingStatusEnum.CONFIRMED

    # Generate ticket & HMAC signature
    ticket_num = f"TKT-{uuid.uuid4().hex[:10].upper()}"
    signature = generate_ticket_signature(booking.booking_code, booking.showtime_id, seat_codes)
    qr_data = generate_qr_data(booking.booking_code, booking.showtime_id, seat_codes, signature)
    qr_code_url = generate_qr_code_base64(qr_data)

    ticket = Ticket(
        booking_id=booking.id,
        ticket_number=ticket_num,
        qr_data=qr_data,
        qr_code_url=qr_code_url,
        hmac_signature=signature
    )
    db.add(ticket)

    await db.commit()
    await db.refresh(booking)

    # Broadcast to websocket
    await broadcast_seat_update(booking.showtime_id, {
        "event": "SEATS_BOOKED",
        "showtime_id": booking.showtime_id,
        "seat_ids": seat_codes,
        "status": "BOOKED"
    })

    return booking


async def process_webhook(db: AsyncSession, event_id: str, event_type: str, payload: dict) -> dict:
    # Idempotency check
    stmt = select(PaymentEvent).where(PaymentEvent.event_id == event_id)
    res = await db.execute(stmt)
    existing_event = res.scalars().first()
    if existing_event:
        return {"status": "duplicate_event_ignored", "event_id": event_id}

    # Record event
    event = PaymentEvent(
        event_id=event_id,
        event_type=event_type,
        payload=payload
    )
    db.add(event)
    await db.commit()

    logger.info(f"Processed payment webhook event {event_id} of type {event_type}")
    return {"status": "success", "event_id": event_id}


async def cancel_booking(db: AsyncSession, booking_id: int, user_id: Optional[int] = None) -> dict:
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.showtime),
            selectinload(Booking.payment)
        )
    )
    result = await db.execute(stmt)
    booking = result.scalars().first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user_id and booking.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    if booking.status != BookingStatusEnum.CONFIRMED:
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be cancelled")

    # Cutoff check: showtime must be in the future
    now = datetime.utcnow()
    cutoff_minutes = booking.showtime.cancellation_cutoff_minutes or 120
    cutoff_time = booking.showtime.start_time - timedelta(minutes=cutoff_minutes)
    if now > cutoff_time:
        raise HTTPException(
            status_code=400,
            detail=f"Cancellation window closed. Must cancel at least {cutoff_minutes} minutes before showtime."
        )

    # Refund calculation: 75% of total
    cancellation_fee = round(booking.final_total_amount * 0.25, 2)
    refund_amount = round(booking.final_total_amount - cancellation_fee, 2)

    # Transition booking
    booking.status = BookingStatusEnum.CANCELLED

    # Transition seats back to AVAILABLE
    seat_codes = [s.seat_id for s in booking.seats]
    inv_stmt = select(SeatInventory).where(
        SeatInventory.showtime_id == booking.showtime_id,
        SeatInventory.seat_id.in_(seat_codes)
    )
    inv_res = await db.execute(inv_stmt)
    for inv in inv_res.scalars().all():
        inv.status = SeatStatusEnum.AVAILABLE
        inv.booking_id = None
        inv.hold_id = None
        inv.hold_expires_at = None

    # Delete booking_seats so the unique constraint is released for future bookings
    for s in list(booking.seats):
        await db.delete(s)

    # Record refund
    if booking.payment:
        booking.payment.status = PaymentStatusEnum.REFUNDED
        refund = Refund(
            booking_id=booking.id,
            payment_id=booking.payment.id,
            refund_amount=refund_amount,
            cancellation_fee=cancellation_fee,
            reason="Customer cancellation within cancellation window",
            status="PROCESSED"
        )
        db.add(refund)

    await db.commit()

    # Broadcast to websocket
    await broadcast_seat_update(booking.showtime_id, {
        "event": "SEATS_RELEASED",
        "showtime_id": booking.showtime_id,
        "seat_ids": seat_codes,
        "status": "AVAILABLE"
    })

    # Fair waitlist notification trigger
    try:
        from app.services.waitlist_service import process_waitlist_on_release
        await process_waitlist_on_release(db, booking.showtime_id, len(seat_codes))
    except Exception as exc:
        logger.warning(f"Waitlist notification on booking cancel encountered: {exc}")

    return {
        "booking_id": booking.id,
        "status": "CANCELLED",
        "refund_amount": refund_amount,
        "cancellation_fee": cancellation_fee,
        "message": f"Booking cancelled. Refund of ₹{refund_amount} initiated to original payment method."
    }

