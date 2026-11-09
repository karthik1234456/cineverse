from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.auth import User, RoleEnum
from app.models.booking import Booking, BookingSeat, BookingStatusEnum
from app.models.showtime import Showtime, PriceRule, SeatInventory, SeatStatusEnum
from app.models.cinema import Auditorium, Seat, Cinema
from app.models.movie import Movie
from app.schemas.admin import AdminAnalyticsResponse, ShowtimeCreateRequest
from app.schemas.cinema import CinemaCoordinatesUpdateRequest, CinemaResponse
from app.services.auth_service import require_role
from app.services.geo_service import generate_directions_url

router = APIRouter()


@router.patch("/cinemas/{cinema_id}/coordinates", response_model=CinemaResponse)
async def update_cinema_coordinates(
    cinema_id: int,
    payload: CinemaCoordinatesUpdateRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Cinema).where(Cinema.id == cinema_id)
    res = await db.execute(stmt)
    cinema = res.scalar_one_or_none()
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")

    cinema.latitude = payload.latitude
    cinema.longitude = payload.longitude
    if payload.address is not None:
        cinema.address = payload.address
    if payload.pincode is not None:
        cinema.pincode = payload.pincode
    if payload.landmark is not None:
        cinema.landmark = payload.landmark
    if payload.parking is not None:
        cinema.parking = payload.parking
    if payload.transit_stop is not None:
        cinema.transit_stop = payload.transit_stop
    if payload.phone is not None:
        cinema.phone = payload.phone
    if payload.opening_hours is not None:
        cinema.opening_hours = payload.opening_hours

    await db.commit()
    await db.refresh(cinema)

    return CinemaResponse(
        id=cinema.id,
        city_id=cinema.city_id,
        name=cinema.name,
        slug=cinema.slug,
        address=cinema.address,
        latitude=cinema.latitude,
        longitude=cinema.longitude,
        cancellation_policy=cinema.cancellation_policy or "Cancellation available up to 2 hours before showtime. 75% refund.",
        facilities=cinema.facilities or [],
        images=cinema.images or [],
        pincode=cinema.pincode,
        landmark=cinema.landmark,
        parking=cinema.parking or "Covered",
        transit_stop=cinema.transit_stop,
        phone=cinema.phone or "+91 80 4000 1234",
        opening_hours=cinema.opening_hours or "09:00 AM - 11:30 PM",
        is_demo_data=cinema.is_demo_data if cinema.is_demo_data is not None else True,
        distance_km=None,
        directions_url=generate_directions_url(cinema.latitude, cinema.longitude)
    )


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


@router.get("/operations/dashboard")
async def get_cinema_operations_dashboard(
    cinema_id: int,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Cinema operations dashboard for managers:
    Returns today's shows with live occupancy, scan admission counts,
    food orders, cancellations, and refunds.
    Enforces cinema manager isolation: each manager sees only their own cinema.
    """
    if current_user.role == RoleEnum.CINEMA_MANAGER:
        if current_user.cinema_id is not None and current_user.cinema_id != cinema_id:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Cinema manager is not authorized to access cinema {cinema_id}"
            )

    cinema = await db.get(Cinema, cinema_id)
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    shows_stmt = (
        select(Showtime)
        .where(
            Showtime.cinema_id == cinema_id,
            Showtime.start_time >= today_start,
            Showtime.start_time < today_end
        )
        .options(
            selectinload(Showtime.movie),
            selectinload(Showtime.auditorium)
        )
        .order_by(Showtime.start_time.asc())
    )
    shows_res = await db.execute(shows_stmt)
    shows = shows_res.scalars().all()

    from app.models.operations import TicketScanLog, ScanResultEnum, FoodOrder, FoodDeliveryStatusEnum

    shows_data = []
    total_scans_today = 0
    total_food_orders_today = 0
    total_cancellations_today = 0
    total_refunds_today = 0.0

    for sh in shows:
        # Occupancy
        inv_stmt = select(SeatInventory).where(SeatInventory.showtime_id == sh.id)
        inv_res = await db.execute(inv_stmt)
        invs = inv_res.scalars().all()
        total_capacity = len(invs) or 1
        booked_seats = sum(1 for i in invs if i.status in [SeatStatusEnum.BOOKED, SeatStatusEnum.HELD])
        occupancy_pct = round((booked_seats / total_capacity) * 100, 1)

        # Scans
        from app.models.booking import Ticket
        scan_stmt = (
            select(func.count(TicketScanLog.id))
            .join(Ticket, TicketScanLog.ticket_id == Ticket.id)
            .join(Booking, Ticket.booking_id == Booking.id)
            .where(
                Booking.showtime_id == sh.id,
                TicketScanLog.scan_result.in_([ScanResultEnum.SUCCESS, ScanResultEnum.OFFLINE_RESOLVED])
            )
        )
        scan_res = await db.execute(scan_stmt)
        admitted_scans = scan_res.scalar() or 0
        total_scans_today += admitted_scans

        # Food orders
        food_stmt = select(FoodOrder).where(FoodOrder.showtime_id == sh.id)
        food_res = await db.execute(food_stmt)
        food_orders = food_res.scalars().all()
        food_count = len(food_orders)
        total_food_orders_today += food_count

        food_preparing = sum(1 for fo in food_orders if fo.delivery_status == FoodDeliveryStatusEnum.PREPARING)
        food_ready = sum(1 for fo in food_orders if fo.delivery_status == FoodDeliveryStatusEnum.READY)
        food_delivered = sum(1 for fo in food_orders if fo.delivery_status == FoodDeliveryStatusEnum.DELIVERED)

        # Cancellations & refunds for this showtime
        cancel_stmt = select(Booking).where(
            Booking.showtime_id == sh.id,
            Booking.status == BookingStatusEnum.CANCELLED
        )
        cancel_res = await db.execute(cancel_stmt)
        cancelled_bookings = cancel_res.scalars().all()
        cancel_count = len(cancelled_bookings)
        refund_amount = sum(b.final_total_amount * 0.75 for b in cancelled_bookings)  # 75% refund policy
        total_cancellations_today += cancel_count
        total_refunds_today += refund_amount

        shows_data.append({
            "showtime_id": sh.id,
            "movie_title": sh.movie.title if sh.movie else "Feature Film",
            "auditorium_name": sh.auditorium.name if sh.auditorium else f"Auditorium {sh.auditorium_id}",
            "start_time": sh.start_time.isoformat(),
            "format": sh.format,
            "language": sh.language,
            "total_capacity": total_capacity,
            "booked_seats": booked_seats,
            "occupancy_percentage": occupancy_pct,
            "admitted_scans": admitted_scans,
            "food_orders_count": food_count,
            "food_breakdown": {
                "preparing": food_preparing,
                "ready": food_ready,
                "delivered": food_delivered
            },
            "cancellations_count": cancel_count,
            "refund_amount_inr": round(refund_amount, 2)
        })

    return {
        "cinema_id": cinema.id,
        "cinema_name": cinema.name,
        "date": today_start.strftime("%Y-%m-%d"),
        "total_shows": len(shows),
        "total_admitted_scans": total_scans_today,
        "total_food_orders": total_food_orders_today,
        "total_cancellations": total_cancellations_today,
        "total_refunds_inr": round(total_refunds_today, 2),
        "shows": shows_data
    }


@router.get("/operations/export")
async def export_cinema_operations_csv(
    cinema_id: int,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Exports cinema operations telemetry as CSV."""
    dash = await get_cinema_operations_dashboard(cinema_id, current_user, db)
    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Showtime ID", "Movie Title", "Auditorium", "Start Time", "Capacity",
        "Booked Seats", "Occupancy %", "Admitted Scans", "Food Orders", "Cancellations", "Refunds (INR)"
    ])
    for s in dash["shows"]:
        writer.writerow([
            s["showtime_id"], s["movie_title"], s["auditorium_name"], s["start_time"],
            s["total_capacity"], s["booked_seats"], f"{s['occupancy_percentage']}%",
            s["admitted_scans"], s["food_orders_count"], s["cancellations_count"], s["refund_amount_inr"]
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cinema_{cinema_id}_operations_{dash['date']}.csv"}
    )


@router.get("/catalog/status")
async def get_catalog_status(
    db: AsyncSession = Depends(get_db)
):
    """Returns current catalog provider state and licensing status."""
    from app.config import settings
    from app.services.catalog.factory import get_catalog_provider
    provider = get_catalog_provider()
    
    # Count TMDB vs local movies
    res_tmdb = await db.execute(select(func.count(Movie.id)).where(Movie.is_tmdb.is_(True)))
    tmdb_count = res_tmdb.scalar() or 0
    res_all = await db.execute(select(func.count(Movie.id)))
    total_count = res_all.scalar() or 0

    return {
        "catalog_source": settings.CATALOG_SOURCE,
        "active_provider": provider.source_name,
        "has_tmdb_key": bool(settings.TMDB_API_KEY),
        "tmdb_movies_count": tmdb_count,
        "total_movies_count": total_count,
        "licensing_warning": "TMDB API free tier is for demonstration and non-commercial testing only. A commercial launch requires official content licensing and commercial TMDB terms.",
        "is_demo_mode": True,
    }


@router.post("/catalog/sync")
async def trigger_catalog_sync(
    languages: Optional[List[str]] = None,
    force_refresh: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Triggers an idempotent sync of movies from the active catalog provider."""
    from app.services.catalog.factory import get_catalog_provider
    provider = get_catalog_provider()
    report = await provider.sync_catalog(db, languages=languages, force_refresh=force_refresh)
    return report


