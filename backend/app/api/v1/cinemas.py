from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.cinema import Cinema, Auditorium
from app.models.technical_specs import ScreenFormat, SoundSystem, ProjectionType
from app.models.movie import Movie
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.schemas.cinema import CinemaResponse, CinemaDetailResponse
from app.services.geo_service import haversine_distance_km, generate_directions_url

router = APIRouter()


@router.get("/", response_model=List[CinemaResponse])
async def list_cinemas(
    city_id: Optional[int] = None,
    search: Optional[str] = None,
    format: Optional[str] = Query(None, description="Screen format filter (comma-separated for multi-select)"),
    sound: Optional[str] = Query(None, description="Sound system filter (comma-separated for multi-select)"),
    projection: Optional[str] = Query(None, description="Projection filter (comma-separated for multi-select)"),
    user_lat: Optional[float] = Query(None, description="User latitude (rounded to 2 decimal places)"),
    user_lng: Optional[float] = Query(None, description="User longitude (rounded to 2 decimal places)"),
    max_distance_km: Optional[float] = Query(None, description="Filter within distance in km (e.g. 5, 10, 20)"),
    sort_by: Optional[str] = Query(None, description="'distance' or 'name'"),
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
    
    # Technical specs filters for cinemas
    if format or sound or projection:
        stmt = stmt.join(Auditorium, Auditorium.cinema_id == Cinema.id)
        if format and format.lower() != "all":
            fmts = [f.strip().lower() for f in format.split(",") if f.strip()]
            if fmts:
                stmt = stmt.outerjoin(ScreenFormat, ScreenFormat.id == Auditorium.screen_format_id)\
                           .where(or_(
                               func.lower(ScreenFormat.name).in_(fmts),
                               func.lower(Auditorium.screen_type).in_(fmts)
                           ))
        if sound and sound.lower() != "all":
            snds = [s.strip().lower() for s in sound.split(",") if s.strip()]
            if snds:
                stmt = stmt.outerjoin(SoundSystem, SoundSystem.id == Auditorium.sound_system_id)\
                           .where(func.lower(SoundSystem.name).in_(snds))
        if projection and projection.lower() != "all":
            prjs = [p.strip().lower() for p in projection.split(",") if p.strip()]
            if prjs:
                stmt = stmt.outerjoin(ProjectionType, ProjectionType.id == Auditorium.projection_type_id)\
                           .where(func.lower(ProjectionType.name).in_(prjs))
        stmt = stmt.distinct()

    stmt = stmt.order_by(Cinema.name)

    result = await db.execute(stmt)
    cinemas = list(result.scalars().all())

    # Ensure user coordinates are rounded to 2 decimal places (~1km) for DPDP privacy
    u_lat = round(user_lat, 2) if user_lat is not None else None
    u_lng = round(user_lng, 2) if user_lng is not None else None

    cinema_responses = []
    for c in cinemas:
        dist_km = None
        if u_lat is not None and u_lng is not None and c.latitude is not None and c.longitude is not None:
            dist_km = haversine_distance_km(u_lat, u_lng, c.latitude, c.longitude)

        if max_distance_km is not None and dist_km is not None and dist_km > max_distance_km:
            continue

        item = CinemaResponse(
            id=c.id,
            city_id=c.city_id,
            name=c.name,
            slug=c.slug,
            address=c.address,
            latitude=c.latitude,
            longitude=c.longitude,
            cancellation_policy=c.cancellation_policy or "Cancellation available up to 2 hours before showtime. 75% refund.",
            facilities=c.facilities or [],
            images=c.images or [],
            pincode=c.pincode,
            landmark=c.landmark,
            parking=c.parking or "Covered",
            transit_stop=c.transit_stop,
            phone=c.phone or "+91 80 4000 1234",
            opening_hours=c.opening_hours or "09:00 AM - 11:30 PM",
            is_demo_data=c.is_demo_data if c.is_demo_data is not None else True,
            distance_km=dist_km,
            directions_url=generate_directions_url(c.latitude, c.longitude)
        )
        cinema_responses.append(item)

    if sort_by == "distance" and u_lat is not None and u_lng is not None:
        cinema_responses.sort(key=lambda x: (x.distance_km if x.distance_km is not None else float("inf"), x.name))

    if limit is not None:
        cinema_responses = cinema_responses[offset:offset + limit]

    return cinema_responses


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

    res = CinemaDetailResponse.model_validate(cinema)
    res.directions_url = generate_directions_url(cinema.latitude, cinema.longitude)
    return res


@router.get("/{cinema_id}/showtimes")
async def get_cinema_showtimes(
    cinema_id: int,
    target_date: Optional[str] = None,
    format: Optional[str] = Query(None, description="Screen format filter (comma-separated for multi-select)"),
    sound: Optional[str] = Query(None, description="Sound system filter (comma-separated for multi-select)"),
    projection: Optional[str] = Query(None, description="Projection filter (comma-separated for multi-select)"),
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
            selectinload(Showtime.auditorium).selectinload(Auditorium.screen_format),
            selectinload(Showtime.auditorium).selectinload(Auditorium.sound_system),
            selectinload(Showtime.auditorium).selectinload(Auditorium.projection_type),
            selectinload(Showtime.price_rules),
            selectinload(Showtime.seat_inventory)
        )
        .order_by(Showtime.start_time)
    )

    result = await db.execute(stmt)
    all_showtimes = result.scalars().all()

    # Parse multi-select filter lists
    filter_fmts = [f.strip().lower() for f in format.split(",") if f.strip()] if format and format.lower() != "all" else []
    filter_snds = [s.strip().lower() for s in sound.split(",") if s.strip()] if sound and sound.lower() != "all" else []
    filter_prjs = [p.strip().lower() for p in projection.split(",") if p.strip()] if projection and projection.lower() != "all" else []

    # Group showtimes by movie
    grouped_by_movie: Dict[int, Dict[str, Any]] = {}
    for st in all_showtimes:
        aud = st.auditorium
        fmt_name = aud.screen_format_name if aud else (st.format or "2D")
        snd_name = aud.sound_system_name if aud else "Standard 5.1"
        prj_name = aud.projection_type_name if aud else "Standard digital"

        if filter_fmts and fmt_name.lower() not in filter_fmts and (st.format or "").lower() not in filter_fmts:
            continue
        if filter_snds and snd_name.lower() not in filter_snds:
            continue
        if filter_prjs and prj_name.lower() not in filter_prjs:
            continue

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

        tech_specs = aud.tech_specs_display if aud else f"{aud.name if aud else 'Screen 1'} · {fmt_name} · {snd_name} · {prj_name}"
        requires_glasses = aud.screen_format.requires_glasses if (aud and aud.screen_format) else ("3D" in fmt_name)
        confirmed_with_cinema = aud.confirmed_with_cinema if aud else False
        is_demo = aud.is_demo if aud else True

        grouped_by_movie[movie.id]["showtimes"].append({
            "id": st.id,
            "movie_id": st.movie_id,
            "auditorium_id": st.auditorium_id,
            "auditorium_name": aud.name if aud else "Screen 1",
            "screen_type": fmt_name,
            "has_3d_preview": aud.has_3d_preview if aud else True,
            "start_time": st.start_time,
            "end_time": st.end_time,
            "format": fmt_name,
            "screen_format": fmt_name,
            "sound_system": snd_name,
            "projection_type": prj_name,
            "tech_specs_display": tech_specs,
            "requires_glasses": requires_glasses,
            "confirmed_with_cinema": confirmed_with_cinema,
            "is_demo": is_demo,
            "language": st.language,
            "lowest_price": lowest_price,
            "availability_status": avail_status,
            "available_seat_count": available_seats,
            "total_seat_count": total_seats
        })

    return list(grouped_by_movie.values())

