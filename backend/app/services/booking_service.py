import random
from datetime import datetime
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.booking import Booking, BookingSeat, BookingAddon, FnbItem, BookingStatusEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.promotion import Coupon, CouponRedemption, DiscountTypeEnum
from app.schemas.booking import BookingCreateRequest


def generate_booking_code() -> str:
    num = random.randint(100000, 999999)
    return f"CV-{num}"


async def validate_coupon(
    db: AsyncSession,
    code: str,
    user_id: Optional[int],
    order_amount: float
) -> tuple[Coupon, float]:
    stmt = select(Coupon).where(Coupon.code == code, Coupon.is_active == True)
    result = await db.execute(stmt)
    coupon = result.scalars().first()

    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code")

    if coupon.valid_until and coupon.valid_until < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Coupon has expired")

    if order_amount < coupon.min_order_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order amount for this coupon is ₹{coupon.min_order_amount}"
        )

    # Check user redemption count if user is authenticated
    if user_id is not None:
        redemptions_stmt = select(CouponRedemption).where(
            CouponRedemption.coupon_id == coupon.id,
            CouponRedemption.user_id == user_id
        )
        red_res = await db.execute(redemptions_stmt)
        user_redemptions = len(red_res.scalars().all())
        if user_redemptions >= coupon.usage_limit_per_user:
            raise HTTPException(
                status_code=400,
                detail="You have already redeemed this coupon the maximum allowed times"
            )

    if coupon.discount_type == DiscountTypeEnum.PERCENTAGE:
        discount = (coupon.discount_value / 100.0) * order_amount
        discount = min(discount, coupon.max_discount_amount)
    else:
        discount = min(coupon.discount_value, order_amount)

    return coupon, round(discount, 2)


async def create_booking(
    db: AsyncSession,
    user_id: int,
    request: BookingCreateRequest
) -> Booking:
    # 1. Fetch showtime
    showtime_stmt = (
        select(Showtime)
        .where(Showtime.id == request.showtime_id)
        .options(
            selectinload(Showtime.movie),
            selectinload(Showtime.cinema),
            selectinload(Showtime.auditorium)
        )
    )
    st_res = await db.execute(showtime_stmt)
    showtime = st_res.scalars().first()
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    # 2. Verify held seats
    now = datetime.utcnow()
    seats_stmt = select(SeatInventory).where(
        SeatInventory.showtime_id == request.showtime_id,
        SeatInventory.seat_id.in_(request.seat_ids),
        SeatInventory.hold_id == request.hold_id
    )
    seats_res = await db.execute(seats_stmt)
    held_seats = seats_res.scalars().all()

    if len(held_seats) != len(request.seat_ids):
        raise HTTPException(
            status_code=400,
            detail="Hold expired or one or more seats are not reserved by this hold ID"
        )

    for s in held_seats:
        if s.hold_expires_at and s.hold_expires_at <= now:
            raise HTTPException(
                status_code=400,
                detail=f"Hold has expired for seat {s.seat_id}. Please select seats again."
            )

    # 3. Calculate ticket amount
    total_ticket_amount = sum(s.price for s in held_seats)
    ticket_count = len(held_seats)
    convenience_fee = round(settings.CONVENIENCE_FEE_PER_TICKET * ticket_count, 2)
    gst_amount = round((convenience_fee * settings.GST_PERCENTAGE) / 100.0, 2)

    # 4. Calculate addons
    addons_amount = 0.0
    addon_records = []
    if request.addons:
        fnb_ids = [a.fnb_item_id for a in request.addons]
        fnb_stmt = select(FnbItem).where(FnbItem.id.in_(fnb_ids))
        fnb_res = await db.execute(fnb_stmt)
        fnb_map = {item.id: item for item in fnb_res.scalars().all()}

        for addon in request.addons:
            item = fnb_map.get(addon.fnb_item_id)
            if not item:
                continue
            line_total = round(item.price * addon.quantity, 2)
            addons_amount += line_total
            addon_records.append({
                "fnb_item_id": item.id,
                "name": item.name,
                "quantity": addon.quantity,
                "unit_price": item.price,
                "total_price": line_total
            })

    subtotal = total_ticket_amount + convenience_fee + gst_amount + addons_amount

    # 5. Apply coupon if provided
    discount_amount = 0.0
    matched_coupon = None
    if request.coupon_code:
        matched_coupon, discount_amount = await validate_coupon(
            db, request.coupon_code.upper().strip(), user_id, total_ticket_amount
        )

    final_total_amount = max(0.0, round(subtotal - discount_amount, 2))

    # 6. Create Booking
    booking = Booking(
        booking_code=generate_booking_code(),
        user_id=user_id,
        showtime_id=showtime.id,
        status=BookingStatusEnum.PENDING,
        total_ticket_amount=total_ticket_amount,
        convenience_fee=convenience_fee,
        gst_amount=gst_amount,
        addons_amount=addons_amount,
        discount_amount=discount_amount,
        final_total_amount=final_total_amount,
        contact_email=request.contact_email,
        contact_phone=request.contact_phone
    )
    db.add(booking)
    await db.flush()

    # Add booking seats
    for s in held_seats:
        b_seat = BookingSeat(
            booking_id=booking.id,
            seat_id=s.seat_id,
            category=s.category,
            price=s.price
        )
        db.add(b_seat)
        # Update seat inventory to PAYMENT_PENDING
        s.status = SeatStatusEnum.PAYMENT_PENDING
        s.booking_id = booking.id

    # Add booking addons
    for a in addon_records:
        b_addon = BookingAddon(
            booking_id=booking.id,
            fnb_item_id=a["fnb_item_id"],
            name=a["name"],
            quantity=a["quantity"],
            unit_price=a["unit_price"],
            total_price=a["total_price"]
        )
        db.add(b_addon)

    # Record coupon redemption if applicable
    if matched_coupon:
        redemption = CouponRedemption(
            coupon_id=matched_coupon.id,
            user_id=user_id,
            booking_id=booking.id,
            discount_amount=discount_amount
        )
        db.add(redemption)

    await db.commit()
    await db.refresh(booking)

    return booking
