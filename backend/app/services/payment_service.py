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
from app.models.audit import Notification
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


def compute_refund_breakdown_paise(booking: Booking, cutoff_minutes: int = 120) -> dict:
    ticket_amount_paise = round(booking.total_ticket_amount * 100)
    # Standard cinema policy: 75% refund on ticket base (25% cancellation charge)
    cancellation_fee_paise = round(ticket_amount_paise * 0.25)
    ticket_refund_paise = ticket_amount_paise - cancellation_fee_paise

    addons_amount_paise = round((booking.addons_amount or 0.0) * 100)
    addons_refund_paise = addons_amount_paise  # 100% refund on pre-ordered F&B

    convenience_fee_paise = round((booking.convenience_fee or 0.0) * 100)
    convenience_fee_refund_paise = 0  # Non-refundable convenience fee

    gst_amount_paise = round((booking.gst_amount or 0.0) * 100)
    gst_refund_paise = 0  # Non-refundable taxes on fee

    discount_amount_paise = round((booking.discount_amount or 0.0) * 100)
    total_paid_paise = round(booking.final_total_amount * 100)

    # Net refundable amount
    net_refund_paise = ticket_refund_paise + addons_refund_paise - discount_amount_paise
    total_refund_paise = max(0, min(total_paid_paise, net_refund_paise))
    effective_cancellation_fee_paise = total_paid_paise - total_refund_paise

    hours = cutoff_minutes // 60 if cutoff_minutes >= 60 else cutoff_minutes
    unit = "hours" if cutoff_minutes >= 60 else "minutes"
    policy_text = (
        f"Cancellation available up to {hours} {unit} before showtime. "
        f"75% refund on tickets, 100% on F&B. Convenience fee & taxes are non-refundable. "
        f"You will receive ₹{total_refund_paise / 100:,.2f} back to your original payment method."
    )

    return {
        "ticket_amount_paise": ticket_amount_paise,
        "ticket_refund_paise": ticket_refund_paise,
        "addons_amount_paise": addons_amount_paise,
        "addons_refund_paise": addons_refund_paise,
        "convenience_fee_paise": convenience_fee_paise,
        "convenience_fee_refund_paise": convenience_fee_refund_paise,
        "gst_amount_paise": gst_amount_paise,
        "gst_refund_paise": gst_refund_paise,
        "discount_amount_paise": discount_amount_paise,
        "cancellation_fee_paise": effective_cancellation_fee_paise,
        "total_paid_paise": total_paid_paise,
        "total_refund_paise": total_refund_paise,
        # Formatted rupee strings for UI display
        "ticket_amount_display": f"₹{ticket_amount_paise / 100:,.2f}",
        "ticket_refund_display": f"₹{ticket_refund_paise / 100:,.2f}",
        "addons_amount_display": f"₹{addons_amount_paise / 100:,.2f}",
        "addons_refund_display": f"₹{addons_refund_paise / 100:,.2f}",
        "convenience_fee_display": f"₹{convenience_fee_paise / 100:,.2f}",
        "gst_amount_display": f"₹{gst_amount_paise / 100:,.2f}",
        "cancellation_fee_display": f"₹{effective_cancellation_fee_paise / 100:,.2f}",
        "total_paid_display": f"₹{total_paid_paise / 100:,.2f}",
        "total_refund_display": f"₹{total_refund_paise / 100:,.2f}",
        "policy_text": policy_text,
    }


async def get_cancellation_quote(
    db: AsyncSession,
    booking_id: int,
    user_id: Optional[int] = None,
    is_admin: bool = False
) -> dict:
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.showtime),
            selectinload(Booking.ticket),
            selectinload(Booking.refund)
        )
    )
    res = await db.execute(stmt)
    booking = res.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user_id and not is_admin and booking.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this booking")

    cutoff_minutes = booking.showtime.cancellation_cutoff_minutes if (booking.showtime and booking.showtime.cancellation_cutoff_minutes) else 120
    cutoff_time = (booking.showtime.start_time - timedelta(minutes=cutoff_minutes)) if booking.showtime else (booking.created_at + timedelta(days=1))
    now = datetime.utcnow()

    is_late = now > cutoff_time
    is_used = bool(booking.ticket and booking.ticket.is_used)

    can_cancel = True
    reason_ineligible = None

    if booking.status == BookingStatusEnum.CANCELLED:
        can_cancel = False
        reason_ineligible = "Booking is already cancelled"
    elif is_used:
        can_cancel = False
        reason_ineligible = "Ticket has already been scanned and used at the theatre."
    elif is_late:
        can_cancel = False
        reason_ineligible = f"Cancellation window closed. Must cancel at least {cutoff_minutes} minutes before showtime."
    elif booking.status != BookingStatusEnum.CONFIRMED:
        can_cancel = False
        reason_ineligible = f"Booking status '{booking.status}' is not eligible for cancellation."

    breakdown = compute_refund_breakdown_paise(booking, cutoff_minutes)

    return {
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "can_cancel": can_cancel,
        "cancellation_cutoff_minutes": cutoff_minutes,
        "cutoff_time": cutoff_time,
        "is_late": is_late,
        "is_used": is_used,
        "reason_ineligible": reason_ineligible,
        "policy_text": breakdown["policy_text"],
        "breakdown": breakdown
    }


STATUS_RANK = {
    "REQUESTED": 1,
    "PROCESSING": 2,
    "REFUNDED": 3,
    "FAILED": 3
}


async def process_webhook(db: AsyncSession, event_id: str, event_type: str, payload: dict) -> dict:
    # 1. Duplicate check (Idempotency)
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

    now = datetime.utcnow()

    # 2. Handle refund webhooks
    if event_type in ("refund.created", "refund.speed_processed", "refund.processed", "refund.failed"):
        refund_entity = payload.get("payload", {}).get("refund", {}).get("entity", {}) if "payload" in payload else payload.get("refund", payload)
        payment_id_str = refund_entity.get("payment_id")
        gateway_refund_id = refund_entity.get("id")
        booking_id = refund_entity.get("notes", {}).get("booking_id")

        # Find refund record
        r_stmt = select(Refund)
        if gateway_refund_id:
            r_stmt = r_stmt.where((Refund.gateway_refund_id == gateway_refund_id) | (Refund.booking_id == booking_id))
        elif booking_id:
            r_stmt = r_stmt.where(Refund.booking_id == int(booking_id))
        elif payment_id_str:
            pay_stmt = select(Payment).where(Payment.razorpay_payment_id == payment_id_str)
            p_res = await db.execute(pay_stmt)
            p = p_res.scalars().first()
            if p:
                r_stmt = r_stmt.where(Refund.payment_id == p.id)

        r_res = await db.execute(r_stmt)
        refund = r_res.scalars().first()

        if refund:
            current_status = refund.status or "REQUESTED"
            current_rank = STATUS_RANK.get(current_status, 1)

            target_status = "PROCESSING"
            if event_type == "refund.processed":
                target_status = "REFUNDED"
            elif event_type == "refund.failed":
                target_status = "FAILED"

            target_rank = STATUS_RANK.get(target_status, 2)

            # Monotonicity check: out-of-order webhooks cannot regress status
            if target_rank >= current_rank:
                refund.status = target_status
                refund.updated_at = now
                if not refund.gateway_refund_id and gateway_refund_id:
                    refund.gateway_refund_id = gateway_refund_id

                tl = list(refund.timeline or [])
                if target_status == "PROCESSING":
                    tl.append({
                        "status": "PROCESSING",
                        "timestamp": now.isoformat(),
                        "note": f"Refund is being processed by gateway (ID: {gateway_refund_id or 'gw_ref'})"
                    })
                elif target_status == "REFUNDED":
                    tl.append({
                        "status": "REFUNDED",
                        "timestamp": now.isoformat(),
                        "note": "Refund successfully credited to customer bank/card account."
                    })
                    # In-app notification for successful credit
                    b_stmt = select(Booking).where(Booking.id == refund.booking_id)
                    b_res = await db.execute(b_stmt)
                    b = b_res.scalars().first()
                    if b and b.user_id:
                        db.add(Notification(
                            user_id=b.user_id,
                            title="Refund Completed",
                            message=f"Refund of ₹{refund.refund_amount} for booking {b.booking_code} has been successfully credited.",
                            type="BOOKING",
                            created_at=now
                        ))
                elif target_status == "FAILED":
                    err = refund_entity.get("error_description") or refund_entity.get("error_reason") or "Gateway reported refund failure"
                    refund.is_stuck = True
                    refund.error_message = str(err)
                    tl.append({
                        "status": "FAILED",
                        "timestamp": now.isoformat(),
                        "note": f"Gateway refund failure: {err}"
                    })
                    b_stmt = select(Booking).where(Booking.id == refund.booking_id)
                    b_res = await db.execute(b_stmt)
                    b = b_res.scalars().first()
                    if b and b.user_id:
                        db.add(Notification(
                            user_id=b.user_id,
                            title="Refund Processing Delayed",
                            message=f"Refund for booking {b.booking_code} encountered an issue. Our operations team is resolving it.",
                            type="ALERT",
                            created_at=now
                        ))

                refund.timeline = tl
            else:
                logger.info(f"Ignored out-of-order webhook event {event_type} for refund {refund.id} (current: {current_status})")

    await db.commit()
    logger.info(f"Processed payment webhook event {event_id} of type {event_type}")
    return {"status": "success", "event_id": event_id}


async def cancel_booking(
    db: AsyncSession,
    booking_id: int,
    user_id: Optional[int] = None,
    is_admin: bool = False
) -> dict:
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.showtime),
            selectinload(Booking.payment),
            selectinload(Booking.ticket),
            selectinload(Booking.refund)
        )
    )
    result = await db.execute(stmt)
    booking = result.scalars().first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user_id and not is_admin and booking.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    # Idempotency / Double-click handling: if already cancelled, return existing details without error
    if booking.status == BookingStatusEnum.CANCELLED:
        refund = booking.refund
        if not refund:
            r_stmt = select(Refund).where(Refund.booking_id == booking.id)
            r_res = await db.execute(r_stmt)
            refund = r_res.scalars().first()
        cutoff_minutes = booking.showtime.cancellation_cutoff_minutes if (booking.showtime and booking.showtime.cancellation_cutoff_minutes) else 120
        breakdown = compute_refund_breakdown_paise(booking, cutoff_minutes)
        return {
            "booking_id": booking.id,
            "status": "CANCELLED",
            "already_cancelled": True,
            "message": "Booking was already cancelled.",
            "refund_amount": refund.refund_amount if refund else round(breakdown["total_refund_paise"] / 100.0, 2),
            "amount_paise": refund.amount_paise if refund else breakdown["total_refund_paise"],
            "cancellation_fee": refund.cancellation_fee if refund else round(breakdown["cancellation_fee_paise"] / 100.0, 2),
            "cancellation_fee_paise": refund.cancellation_fee_paise if refund else breakdown["cancellation_fee_paise"],
            "timeline": refund.timeline if refund else [],
            "breakdown": breakdown
        }

    # Ticket already used check
    if booking.ticket and booking.ticket.is_used:
        raise HTTPException(
            status_code=400,
            detail="Ticket has already been scanned and used at the theatre. Cannot be cancelled."
        )

    if booking.status != BookingStatusEnum.CONFIRMED:
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be cancelled")

    now = datetime.utcnow()
    cutoff_minutes = booking.showtime.cancellation_cutoff_minutes or 120
    cutoff_time = booking.showtime.start_time - timedelta(minutes=cutoff_minutes)
    if now > cutoff_time:
        raise HTTPException(
            status_code=400,
            detail=f"Cancellation window closed. Must cancel at least {cutoff_minutes} minutes before showtime."
        )

    # Compute exact integer paise breakdown
    breakdown = compute_refund_breakdown_paise(booking, cutoff_minutes)
    refund_amount = round(breakdown["total_refund_paise"] / 100.0, 2)
    cancellation_fee = round(breakdown["cancellation_fee_paise"] / 100.0, 2)

    # Transition booking
    booking.status = BookingStatusEnum.CANCELLED

    # Release seats in SeatInventory
    seat_codes = [s.seat_id for s in (booking.seats or [])]
    if seat_codes:
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

    # Delete booking_seats so unique constraint is freed
    for s in list(booking.seats):
        await db.delete(s)

    # Payment status update
    if booking.payment:
        booking.payment.status = PaymentStatusEnum.REFUNDED

    # Initial timeline
    initial_timeline = [
        {
            "status": "REQUESTED",
            "timestamp": now.isoformat(),
            "note": "Cancellation requested by customer. Refund initiated."
        }
    ]

    payment_id = booking.payment.id if booking.payment else 0
    gateway_refund_id = f"rfnd_{uuid.uuid4().hex[:14]}"

    refund = booking.refund
    if not refund:
        refund = Refund(
            booking_id=booking.id,
            payment_id=payment_id,
            refund_amount=refund_amount,
            cancellation_fee=cancellation_fee,
            amount_paise=breakdown["total_refund_paise"],
            cancellation_fee_paise=breakdown["cancellation_fee_paise"],
            ticket_amount_paise=breakdown["ticket_amount_paise"],
            addons_amount_paise=breakdown["addons_amount_paise"],
            convenience_fee_paise=breakdown["convenience_fee_paise"],
            gst_amount_paise=breakdown["gst_amount_paise"],
            gateway_refund_id=gateway_refund_id,
            reason="Customer cancellation within cancellation window",
            status="REQUESTED",
            timeline=initial_timeline,
            is_stuck=False,
            created_at=now,
            updated_at=now
        )
        db.add(refund)
    else:
        refund.status = "REQUESTED"
        refund.refund_amount = refund_amount
        refund.cancellation_fee = cancellation_fee
        refund.amount_paise = breakdown["total_refund_paise"]
        refund.cancellation_fee_paise = breakdown["cancellation_fee_paise"]
        refund.ticket_amount_paise = breakdown["ticket_amount_paise"]
        refund.addons_amount_paise = breakdown["addons_amount_paise"]
        refund.convenience_fee_paise = breakdown["convenience_fee_paise"]
        refund.gst_amount_paise = breakdown["gst_amount_paise"]
        refund.gateway_refund_id = gateway_refund_id
        refund.timeline = initial_timeline
        refund.is_stuck = False
        refund.updated_at = now

    # In-app notification
    if booking.user_id:
        notif = Notification(
            user_id=booking.user_id,
            title="Cancellation Confirmed",
            message=f"Booking {booking.booking_code} cancelled. Refund of ₹{refund_amount} requested to original payment method.",
            type="BOOKING",
            is_read=False,
            created_at=now
        )
        db.add(notif)

    await db.commit()

    # Broadcast seat release to websocket
    if seat_codes:
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

    # Simulated email sending log
    logger.info(f"Cancellation email dispatched to {booking.contact_email} for booking {booking.booking_code} with refund ₹{refund_amount}")

    return {
        "booking_id": booking.id,
        "status": "CANCELLED",
        "refund_amount": refund_amount,
        "amount_paise": breakdown["total_refund_paise"],
        "cancellation_fee": cancellation_fee,
        "cancellation_fee_paise": breakdown["cancellation_fee_paise"],
        "timeline": initial_timeline,
        "breakdown": breakdown,
        "message": f"Booking cancelled successfully. Refund of ₹{refund_amount} initiated to your original payment method."
    }


async def get_stuck_refunds(db: AsyncSession) -> list:
    stmt = (
        select(Refund)
        .where((Refund.is_stuck == True) | (Refund.status == "FAILED"))
        .options(selectinload(Refund.booking).selectinload(Booking.user))
        .order_by(Refund.created_at.desc())
    )
    res = await db.execute(stmt)
    refunds = res.scalars().all()
    results = []
    for r in refunds:
        b = r.booking
        user_name = b.user.full_name if (b and b.user) else "Guest"
        user_email = b.contact_email if b else ""
        results.append({
            "id": r.id,
            "booking_id": r.booking_id,
            "booking_code": b.booking_code if b else "",
            "customer_name": user_name,
            "customer_email": user_email,
            "amount_paise": r.amount_paise or round(r.refund_amount * 100),
            "amount_display": f"₹{(r.amount_paise or round(r.refund_amount * 100)) / 100:,.2f}",
            "cancellation_fee_paise": r.cancellation_fee_paise or round(r.cancellation_fee * 100),
            "gateway_refund_id": r.gateway_refund_id,
            "status": r.status,
            "is_stuck": r.is_stuck,
            "error_message": r.error_message or "Gateway processing halted",
            "timeline": r.timeline or [],
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return results


async def retry_stuck_refund(db: AsyncSession, refund_id: int) -> dict:
    stmt = (
        select(Refund)
        .where(Refund.id == refund_id)
        .options(selectinload(Refund.booking))
    )
    res = await db.execute(stmt)
    refund = res.scalars().first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")

    now = datetime.utcnow()
    refund.is_stuck = False
    refund.status = "PROCESSING"
    refund.error_message = None
    refund.updated_at = now

    tl = list(refund.timeline or [])
    tl.append({
        "status": "PROCESSING",
        "timestamp": now.isoformat(),
        "note": "Refund re-queued and retried by administrator"
    })
    refund.timeline = tl

    await db.commit()
    return {
        "status": "retried",
        "refund_id": refund.id,
        "new_status": "PROCESSING",
        "message": f"Refund #{refund.id} for booking {refund.booking.booking_code if refund.booking else ''} has been retried."
    }


