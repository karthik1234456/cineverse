from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.booking import Booking, BookingSeat, BookingAddon, Ticket, BookingStatusEnum
from app.models.showtime import Showtime
from app.models.auth import User, RoleEnum
from app.schemas.booking import (
    SeatHoldRequest, SeatHoldResponse, SeatReleaseRequest, SeatExtendRequest,
    BookingCreateRequest, BookingResponse, BookingSeatResponse, BookingAddonResponse, TicketResponse
)
from app.services.auth_service import get_current_user, require_user
from app.services.hold_service import hold_seats, release_seats, extend_hold
from app.services.booking_service import create_booking
from app.services.payment_service import cancel_booking

router = APIRouter()


@router.post("/hold", response_model=SeatHoldResponse)
async def api_hold_seats(
    showtime_id: int,
    req: SeatHoldRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    result = await hold_seats(db, showtime_id, req.seat_ids, user_id=user_id)
    return SeatHoldResponse(**result)


@router.post("/release")
async def api_release_seats(req: SeatReleaseRequest, db: AsyncSession = Depends(get_db)):
    result = await release_seats(db, req.hold_id, req.seat_ids)
    return result


@router.post("/extend")
async def api_extend_hold(req: SeatExtendRequest, db: AsyncSession = Depends(get_db)):
    result = await extend_hold(db, req.hold_id)
    return result


@router.post("/create", response_model=BookingResponse)
async def api_create_booking(
    req: BookingCreateRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import logging
    logger = logging.getLogger("cineverse.bookings")
    logger.info("api_create_booking called: %s", req.model_dump())
    # If user is authenticated, link to current user; otherwise find or create guest user by contact_email
    user_id = current_user.id if current_user else None
    if not user_id and req.contact_email:
        res = await db.execute(
            select(User).where(
                (User.email == req.contact_email) | 
                ((User.phone == req.contact_phone) & (User.phone.is_not(None)))
            )
        )
        u = res.scalars().first()
        if u:
            user_id = u.id
        else:
            try:
                guest_user = User(
                    email=req.contact_email,
                    phone=req.contact_phone,
                    full_name=req.contact_email.split('@')[0],
                    role=RoleEnum.CUSTOMER,
                    is_active=True,
                    is_verified=True
                )
                db.add(guest_user)
                await db.flush()
                user_id = guest_user.id
            except Exception as e:
                logger.warning("Guest user create failed: %s", e)
                await db.rollback()
                fallback = await db.execute(select(User).limit(1))
                u_fallback = fallback.scalars().first()
                user_id = u_fallback.id if u_fallback else 1

    if not user_id:
        user_id = 3  # fallback to demo customer

    try:
        booking = await create_booking(db, user_id, req)
        return await format_booking_response(booking, db)
    except HTTPException as he:
        logger.error("Booking create HTTPException: %s", he.detail)
        raise
    except Exception as exc:
        logger.exception("Booking create unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/user/my-bookings", response_model=List[BookingResponse])
async def list_my_bookings(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.addons),
            selectinload(Booking.showtime).selectinload(Showtime.movie),
            selectinload(Booking.showtime).selectinload(Showtime.cinema),
            selectinload(Booking.showtime).selectinload(Showtime.auditorium),
            selectinload(Booking.ticket)
        )
        .order_by(Booking.created_at.desc())
    )
    result = await db.execute(stmt)
    bookings = result.scalars().all()

    responses = []
    for b in bookings:
        responses.append(await format_booking_response(b, db))
    return responses


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_details(
    booking_id: int,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.addons),
            selectinload(Booking.showtime).selectinload(Showtime.movie),
            selectinload(Booking.showtime).selectinload(Showtime.cinema),
            selectinload(Booking.showtime).selectinload(Showtime.auditorium),
            selectinload(Booking.ticket)
        )
    )
    result = await db.execute(stmt)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    return await format_booking_response(booking, db)


@router.post("/{booking_id}/cancel")
async def api_cancel_booking(
    booking_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    result = await cancel_booking(db, booking_id, user_id=user_id)
    return result


async def format_booking_response(booking: Booking, db: AsyncSession) -> BookingResponse:
    # Explicitly load all relationships with selectinload to prevent lazy-load MissingGreenlet errors in asyncpg / aiosqlite
    stmt = (
        select(Booking)
        .where(Booking.id == booking.id)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.addons),
            selectinload(Booking.ticket),
            selectinload(Booking.showtime).selectinload(Showtime.movie),
            selectinload(Booking.showtime).selectinload(Showtime.cinema),
            selectinload(Booking.showtime).selectinload(Showtime.auditorium),
        )
    )
    result = await db.execute(stmt)
    b = result.scalars().first() or booking

    st = b.showtime
    seats_resp = [
        BookingSeatResponse(seat_id=s.seat_id, category=s.category, price=s.price)
        for s in (b.seats or [])
    ]
    addons_resp = [
        BookingAddonResponse(
            fnb_item_id=a.fnb_item_id,
            name=a.name,
            quantity=a.quantity,
            unit_price=a.unit_price,
            total_price=a.total_price
        )
        for a in (b.addons or [])
    ]

    ticket_resp = None
    if b.ticket:
        ticket_resp = TicketResponse(
            ticket_number=b.ticket.ticket_number,
            qr_data=b.ticket.qr_data,
            qr_code_url=b.ticket.qr_code_url,
            hmac_signature=b.ticket.hmac_signature,
            issued_at=b.ticket.issued_at
        )

    return BookingResponse(
        id=b.id,
        booking_code=b.booking_code,
        showtime_id=b.showtime_id,
        movie_title=st.movie.title if (st and st.movie) else "Movie",
        movie_poster_url=st.movie.poster_url if (st and st.movie) else "",
        cinema_name=st.cinema.name if (st and st.cinema) else "Cinema",
        cinema_address=st.cinema.address if (st and st.cinema) else "",
        auditorium_name=st.auditorium.name if (st and st.auditorium) else "Screen 1",
        screen_type=st.auditorium.screen_type if (st and st.auditorium) else "IMAX 3D",
        start_time=st.start_time if st else b.created_at,
        seats=seats_resp,
        addons=addons_resp,
        total_ticket_amount=b.total_ticket_amount,
        convenience_fee=b.convenience_fee,
        gst_amount=b.gst_amount,
        addons_amount=b.addons_amount,
        discount_amount=b.discount_amount,
        final_total_amount=b.final_total_amount,
        status=b.status,
        contact_email=b.contact_email,
        contact_phone=b.contact_phone,
        created_at=b.created_at,
        ticket=ticket_resp
    )
