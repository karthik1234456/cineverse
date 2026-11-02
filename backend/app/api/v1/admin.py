from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.auth import User, RoleEnum
from app.models.booking import Booking, BookingSeat, BookingStatusEnum
from app.models.showtime import Showtime, PriceRule, SeatInventory, SeatStatusEnum
from app.models.cinema import Auditorium, Seat
from app.models.movie import Movie
from app.schemas.admin import AdminAnalyticsResponse, ShowtimeCreateRequest
from app.services.auth_service import require_role

router = APIRouter()


@router.get("/analytics", response_model=AdminAnalyticsResponse)
async def get_analytics(
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    # Total revenue & bookings
    rev_stmt = select(
        func.coalesce(func.sum(Booking.final_total_amount), 0.0),
        func.count(Booking.id)
    ).where(Booking.status == BookingStatusEnum.CONFIRMED)
    rev_res = await db.execute(rev_stmt)
    total_rev, total_bkgs = rev_res.first()

    # Total tickets sold
    tkt_stmt = select(func.count(BookingSeat.id)).join(Booking).where(Booking.status == BookingStatusEnum.CONFIRMED)
    tkt_res = await db.execute(tkt_stmt)
    total_tkts = tkt_res.scalar() or 0

    # Overall occupancy
    total_inv_stmt = select(func.count(SeatInventory.id))
    tot_inv_res = await db.execute(total_inv_stmt)
    total_seats_all = tot_inv_res.scalar() or 1

    booked_inv_stmt = select(func.count(SeatInventory.id)).where(SeatInventory.status == SeatStatusEnum.BOOKED)
    bkd_inv_res = await db.execute(booked_inv_stmt)
    total_booked_seats = bkd_inv_res.scalar() or 0

    occupancy = round((total_booked_seats / float(total_seats_all)) * 100.0, 1)

    # Top movies
    top_movies_stmt = (
        select(
            Movie.title,
            func.count(Booking.id).label("booking_count"),
            func.coalesce(func.sum(Booking.final_total_amount), 0.0).label("revenue")
        )
        .join(Showtime, Showtime.movie_id == Movie.id)
        .join(Booking, Booking.showtime_id == Showtime.id)
        .where(Booking.status == BookingStatusEnum.CONFIRMED)
        .group_by(Movie.title)
        .order_by(func.sum(Booking.final_total_amount).desc())
        .limit(5)
    )
    tm_res = await db.execute(top_movies_stmt)
    top_movies = [{"title": r[0], "bookings": r[1], "revenue": float(r[2])} for r in tm_res.all()]

    # Recent bookings
    rec_stmt = (
        select(Booking)
        .where(Booking.status == BookingStatusEnum.CONFIRMED)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.showtime).selectinload(Showtime.movie)
        )
        .order_by(Booking.created_at.desc())
        .limit(10)
    )
    rec_res = await db.execute(rec_stmt)
    recent = []
    for b in rec_res.scalars().all():
        recent.append({
            "id": b.id,
            "booking_code": b.booking_code,
            "movie": b.showtime.movie.title if (b.showtime and b.showtime.movie) else "Movie",
            "amount": b.final_total_amount,
            "seats_count": len(b.seats),
            "created_at": b.created_at.isoformat()
        })

    return AdminAnalyticsResponse(
        total_revenue=float(total_rev),
        total_bookings=int(total_bkgs),
        total_tickets_sold=int(total_tkts),
        overall_occupancy_percentage=occupancy,
        top_movies=top_movies,
        top_cinemas=[],
        recent_bookings=recent
    )


@router.post("/showtimes")
async def create_showtime(
    req: ShowtimeCreateRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    # Conflict check: does auditorium already have a showtime overlapping this window?
    conflict_stmt = select(Showtime).where(
        Showtime.auditorium_id == req.auditorium_id,
        Showtime.start_time < req.end_time,
        Showtime.end_time > req.start_time
    )
    conf_res = await db.execute(conflict_stmt)
    if conf_res.scalars().first():
        raise HTTPException(status_code=400, detail="Auditorium schedule conflict detected for this time slot")

    showtime = Showtime(
        movie_id=req.movie_id,
        cinema_id=req.cinema_id,
        auditorium_id=req.auditorium_id,
        start_time=req.start_time,
        end_time=req.end_time,
        format=req.format,
        language=req.language
    )
    db.add(showtime)
    await db.flush()

    # Add Price Rules
    db.add(PriceRule(showtime_id=showtime.id, category="Front", base_price=req.price_front))
    db.add(PriceRule(showtime_id=showtime.id, category="Prime", base_price=req.price_prime))
    db.add(PriceRule(showtime_id=showtime.id, category="Premier", base_price=req.price_premier))

    # Fetch auditorium seats to instantiate SeatInventory
    seat_stmt = select(Seat).where(Seat.auditorium_id == req.auditorium_id)
    seat_res = await db.execute(seat_stmt)
    seats = seat_res.scalars().all()

    price_map = {"Front": req.price_front, "Prime": req.price_prime, "Premier": req.price_premier}

    for s in seats:
        inv = SeatInventory(
            showtime_id=showtime.id,
            seat_id=s.seat_id,
            category=s.category,
            price=price_map.get(s.category, req.price_prime),
            status=SeatStatusEnum.AVAILABLE
        )
        db.add(inv)

    await db.commit()
    await db.refresh(showtime)

    return {"message": "Showtime created successfully", "showtime_id": showtime.id}

