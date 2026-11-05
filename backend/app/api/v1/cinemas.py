from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.cinema import Cinema, Auditorium
from app.models.movie import Movie
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.schemas.cinema import CinemaResponse, CinemaDetailResponse

router = APIRouter()


@router.get("/", response_model=List[CinemaResponse])
async def list_cinemas(
    city_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Cinema)
    if city_id:
        stmt = stmt.where(Cinema.city_id == city_id)
    if search:
        search_term = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Cinema.name).like(search_term),
                func.lower(Cinema.address).like(search_term)
            )
        )
    stmt = stmt.order_by(Cinema.name)
    if limit is not None:
        stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{id_or_slug}", response_model=CinemaDetailResponse)
async def get_cinema(id_or_slug: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Cinema).options(selectinload(Cinema.auditoriums))
    if id_or_slug.isdigit():
        stmt = stmt.where(Cinema.id == int(id_or_slug))
    else:
        stmt = stmt.where(Cinema.slug == id_or_slug)

    result = await db.execute(stmt)
    cinema = result.scalars().first()
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")

    return cinema


@router.get("/{cinema_id}/showtimes")
async def get_cinema_showtimes(
    cinema_id: int,
    target_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    if target_date:
        try:
            d = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            d = date.today()
    else:
        d = date.today()

    start_of_day = datetime.combine(d, time.min)
    end_of_day = datetime.combine(d, time.max)

    stmt = (
        select(Showtime)
        .where(
            Showtime.cinema_id == cinema_id,
            Showtime.start_time >= start_of_day,
            Showtime.start_time <= end_of_day
        )
        .options(
            selectinload(Showtime.movie),
            selectinload(Showtime.auditorium),
            selectinload(Showtime.price_rules),
            selectinload(Showtime.seat_inventory)
        )
        .order_by(Showtime.start_time)
    )

    result = await db.execute(stmt)
    all_showtimes = result.scalars().all()

    # Group showtimes by movie
    grouped_by_movie: Dict[int, Dict[str, Any]] = {}
    for st in all_showtimes:
        movie = st.movie
        if movie.id not in grouped_by_movie:
            grouped_by_movie[movie.id] = {
                "movie_id": movie.id,
                "title": movie.title,
                "slug": movie.slug,
                "poster_url": movie.poster_url,
                "certificate": movie.certificate,
                "duration_minutes": movie.duration_minutes,
                "languages": movie.languages or [],
                "formats": movie.formats or [],
                "showtimes": []
            }

        lowest_price = 280.0
        if st.price_rules:
            lowest_price = min(pr.base_price for pr in st.price_rules)

        total_seats = len(st.seat_inventory) or 100
        available_seats = sum(1 for s in st.seat_inventory if s.status == SeatStatusEnum.AVAILABLE)

        ratio = available_seats / float(total_seats)
        if ratio == 0:
            avail_status = "SOLD_OUT"
        elif ratio < 0.2:
            avail_status = "ALMOST_FULL"
        elif ratio < 0.6:
            avail_status = "FAST_FILLING"
        else:
            avail_status = "AVAILABLE"

        grouped_by_movie[movie.id]["showtimes"].append({
            "id": st.id,
            "movie_id": st.movie_id,
            "auditorium_id": st.auditorium_id,
            "auditorium_name": st.auditorium.name if st.auditorium else "Screen 1",
            "screen_type": st.auditorium.screen_type if st.auditorium else "IMAX 3D",
            "has_3d_preview": st.auditorium.has_3d_preview if st.auditorium else True,
            "start_time": st.start_time,
            "end_time": st.end_time,
            "format": st.format,
            "language": st.language,
            "lowest_price": lowest_price,
            "availability_status": avail_status,
            "available_seat_count": available_seats,
            "total_seat_count": total_seats
        })

    return list(grouped_by_movie.values())

