from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, distinct
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.movie import Movie, MovieCast, Review
from app.models.showtime import Showtime, PriceRule, SeatInventory, SeatStatusEnum
from app.models.cinema import Cinema, Auditorium, City
from app.models.auth import User
from app.schemas.movie import MovieResponse, MovieDetailResponse, ReviewCreate, ReviewResponse
from app.services.auth_service import get_current_user, require_user
from app.services.geo_service import haversine_distance_km, generate_directions_url

router = APIRouter()


@router.get("/", response_model=List[MovieResponse])
async def list_movies(
    response: Response,
    city_id: Optional[int] = None,
    genre: Optional[str] = None,
    language: Optional[str] = None,
    format: Optional[str] = None,
    certificate: Optional[str] = None,
    status: Optional[str] = None,  # "now_showing" or "coming_soon"
    search: Optional[str] = None,
    sort: Optional[str] = Query("popularity", description="Sort by: popularity, rating, release_date, title"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Movie)

    if city_id:
        if status == "now_showing":
            stmt = stmt.join(Showtime, Showtime.movie_id == Movie.id)\
                       .join(Cinema, Cinema.id == Showtime.cinema_id)\
                       .where(Cinema.city_id == city_id)\
                       .distinct()
        elif status == "coming_soon":
            pass
        else:
            stmt = stmt.outerjoin(Showtime, Showtime.movie_id == Movie.id)\
                       .outerjoin(Cinema, Cinema.id == Showtime.cinema_id)\
                       .where(
                           or_(
                               Cinema.city_id == city_id,
                               Movie.is_coming_soon == True
                           )
                       )\
                       .distinct()

    if status == "now_showing":
        stmt = stmt.where(Movie.is_now_showing == True)
    elif status == "coming_soon":
        stmt = stmt.where(Movie.is_coming_soon == True)

    if certificate:
        stmt = stmt.where(func.upper(Movie.certificate) == certificate.upper())

    if search:
        search_term = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Movie.title).like(search_term),
                func.lower(Movie.synopsis).like(search_term)
            )
        )

    # Sorting
    if sort == "release_date":
        stmt = stmt.order_by(Movie.release_date.desc(), Movie.rating_avg.desc())
    elif sort == "title":
        stmt = stmt.order_by(Movie.title.asc())
    elif sort == "rating":
        stmt = stmt.order_by(Movie.rating_avg.desc(), Movie.rating_count.desc())
    else:  # popularity (default)
        stmt = stmt.order_by(Movie.rating_count.desc(), Movie.rating_avg.desc(), Movie.release_date.desc())

    result = await db.execute(stmt)
    movies = result.scalars().all()

    # In-memory filter for JSON array fields (genres, languages, formats)
    filtered = []
    for m in movies:
        if genre and genre.lower() != "all" and genre not in (m.genres or []):
            continue
        if language and language.lower() != "all" and language not in (m.languages or []):
            continue
        if format and format.lower() != "all" and format not in (m.formats or []):
            continue
        filtered.append(m)

    total_count = len(filtered)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)

    # Slice for pagination
    start = (page - 1) * page_size
    end = start + page_size
    return filtered[start:end]


@router.get("/{id_or_slug}", response_model=MovieDetailResponse)
async def get_movie(id_or_slug: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Movie)
        .options(
            selectinload(Movie.cast_members),
            selectinload(Movie.reviews).selectinload(Review.user)
        )
    )
    if id_or_slug.isdigit():
        stmt = stmt.where(Movie.id == int(id_or_slug))
    else:
        stmt = stmt.where(Movie.slug == id_or_slug)

    result = await db.execute(stmt)
    movie = result.scalars().first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    # Format reviews with user names
    review_responses = []
    for r in movie.reviews:
        if r.is_approved:
            review_responses.append(ReviewResponse(
                id=r.id,
                movie_id=r.movie_id,
                user_id=r.user_id,
                rating=r.rating,
                headline=r.headline,
                content=r.content,
                has_spoilers=r.has_spoilers,
                created_at=r.created_at,
                user_name=r.user.full_name if r.user else "Verified Viewer"
            ))

    return MovieDetailResponse(
        id=movie.id,
        title=movie.title,
        slug=movie.slug,
        synopsis=movie.synopsis,
        poster_url=movie.poster_url,
        banner_url=movie.banner_url,
        trailer_url=movie.trailer_url,
        duration_minutes=movie.duration_minutes,
        certificate=movie.certificate,
        release_date=movie.release_date,
        is_now_showing=movie.is_now_showing,
        is_coming_soon=movie.is_coming_soon,
        rating_avg=movie.rating_avg,
        rating_count=movie.rating_count,
        interested_count=movie.interested_count,
        languages=movie.languages or [],
        genres=movie.genres or [],
        formats=movie.formats or [],
        cast_members=movie.cast_members or [],
        reviews=review_responses
    )


@router.get("/{movie_id}/showtimes")
async def get_movie_showtimes(
    movie_id: int,
    city_id: Optional[int] = None,
    target_date: Optional[str] = None,  # YYYY-MM-DD
    format: Optional[str] = None,
    language: Optional[str] = None,
    user_lat: Optional[float] = Query(None, description="User latitude (rounded to 2 decimal places)"),
    user_lng: Optional[float] = Query(None, description="User longitude (rounded to 2 decimal places)"),
    max_distance_km: Optional[float] = Query(None, description="Filter within distance in km (e.g. 5, 10, 20)"),
    db: AsyncSession = Depends(get_db)
):
    # Parse target date
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
            Showtime.movie_id == movie_id,
            Showtime.start_time >= start_of_day,
            Showtime.start_time <= end_of_day
        )
        .options(
            selectinload(Showtime.cinema),
            selectinload(Showtime.auditorium),
            selectinload(Showtime.price_rules),
            selectinload(Showtime.seat_inventory)
        )
        .order_by(Showtime.start_time)
    )

    result = await db.execute(stmt)
    all_showtimes = result.scalars().all()

    # User coordinates rounded for privacy
    u_lat = round(user_lat, 2) if user_lat is not None else None
    u_lng = round(user_lng, 2) if user_lng is not None else None

    # Filter by city, format, language
    grouped_by_cinema: Dict[int, Dict[str, Any]] = {}

    for st in all_showtimes:
        if city_id and st.cinema.city_id != city_id:
            continue
        if format and format != st.format:
            continue
        if language and language != st.language:
            continue

        cinema = st.cinema
        dist_km = None
        if u_lat is not None and u_lng is not None and cinema.latitude is not None and cinema.longitude is not None:
            dist_km = haversine_distance_km(u_lat, u_lng, cinema.latitude, cinema.longitude)

        if max_distance_km is not None and dist_km is not None and dist_km > max_distance_km:
            continue

        if cinema.id not in grouped_by_cinema:
            grouped_by_cinema[cinema.id] = {
                "cinema_id": cinema.id,
                "cinema_name": cinema.name,
                "slug": cinema.slug,
                "address": cinema.address,
                "latitude": cinema.latitude,
                "longitude": cinema.longitude,
                "pincode": cinema.pincode,
                "landmark": cinema.landmark,
                "parking": cinema.parking or "Covered",
                "transit_stop": cinema.transit_stop,
                "phone": cinema.phone or "+91 80 4000 1234",
                "opening_hours": cinema.opening_hours or "09:00 AM - 11:30 PM",
                "cancellation_policy": cinema.cancellation_policy,
                "facilities": cinema.facilities or [],
                "distance_km": dist_km,
                "directions_url": generate_directions_url(cinema.latitude, cinema.longitude),
                "showtimes": []
            }

        # Calculate lowest price & availability status
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

        grouped_by_cinema[cinema.id]["showtimes"].append({
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

    cinema_list = list(grouped_by_cinema.values())
    if u_lat is not None and u_lng is not None:
        cinema_list.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else float("inf"), x["cinema_name"]))

    return cinema_list


@router.post("/{movie_id}/reviews", response_model=ReviewResponse)
async def post_review(
    movie_id: int,
    req: ReviewCreate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    review = Review(
        movie_id=movie_id,
        user_id=current_user.id,
        rating=max(1, min(10, req.rating)),
        headline=req.headline,
        content=req.content,
        has_spoilers=req.has_spoilers,
        is_approved=True
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    return ReviewResponse(
        id=review.id,
        movie_id=review.movie_id,
        user_id=review.user_id,
        rating=review.rating,
        headline=review.headline,
        content=review.content,
        has_spoilers=review.has_spoilers,
        created_at=review.created_at,
        user_name=current_user.full_name
    )

