import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.auth import User, RoleEnum
from app.models.booking import Booking, BookingSeat, BookingStatusEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum


async def make_test_user(
    db: AsyncSession,
    email: Optional[str] = None,
    full_name: str = "Test User",
    role: RoleEnum = RoleEnum.CUSTOMER,
    loyalty_points: int = 0
) -> User:
    """Factory creating an isolated user instance."""
    unique_email = email or f"user_{uuid.uuid4().hex[:8]}@cineverse-test.in"
    user = User(
        email=unique_email,
        full_name=full_name,
        role=role,
        hashed_password="mock_hashed_pw",
        loyalty_points=loyalty_points,
        loyalty_tier="silver"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def make_test_booking(
    db: AsyncSession,
    showtime_id: int,
    user_id: int,
    seats: List[str],
    status: BookingStatusEnum = BookingStatusEnum.CONFIRMED,
    total_amount: float = 350.0
) -> Booking:
    """Factory creating an isolated booking instance with associated seats."""
    booking_code = f"CV-TST-{uuid.uuid4().hex[:6].upper()}"
    booking = Booking(
        booking_code=booking_code,
        user_id=user_id,
        showtime_id=showtime_id,
        status=status,
        total_ticket_amount=total_amount,
        final_total_amount=total_amount,
        contact_email=f"tester_{uuid.uuid4().hex[:6]}@cineverse.in",
        contact_phone="9988776655"
    )
    db.add(booking)
    await db.flush()

    for seat_id in seats:
        b_seat = BookingSeat(
            booking_id=booking.id,
            showtime_id=showtime_id,
            seat_id=seat_id,
            category="premier",
            price=total_amount / len(seats)
        )
        db.add(b_seat)

    await db.commit()
    await db.refresh(booking)
    return booking
