import time
from collections import defaultdict
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.movie import Movie, MovieCast
from app.models.cinema import Cinema, City
from app.schemas.movie import MovieResponse
from app.schemas.cinema import CinemaResponse

router = APIRouter()

# In-memory sliding window rate limiter: max 60 requests per minute per IP
SEARCH_RATE_LIMIT = 60
SEARCH_WINDOW_SECONDS = 60
_search_request_history: Dict[str, List[float]] = defaultdict(list)


def check_search_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    cutoff = now - SEARCH_WINDOW_SECONDS
    
    # Filter out timestamps older than window
    timestamps = [t for t in _search_request_history[client_ip] if t > cutoff]
    if len(timestamps) >= SEARCH_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for search. Please wait before searching again.",
            headers={"Retry-After": str(SEARCH_WINDOW_SECONDS)}
        )
    timestamps.append(now)
    _search_request_history[client_ip] = timestamps


@router.get("/")
async def global_search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100, description="Search query string"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    check_search_rate_limit(request)

    # Sanitize search term against dangerous wildcards/escapes
    clean_q = q.strip().replace("%", "\\%").replace("_", "\\_")
    search_term = f"%{clean_q.lower()}%"

    # 1. Search Movies (by title, synopsis, genres, or actor name)
    movie_stmt = (
        select(Movie)
        .outerjoin(MovieCast, MovieCast.movie_id == Movie.id)
        .where(
            or_(
                func.lower(Movie.title).like(search_term),
                func.lower(Movie.synopsis).like(search_term),
                func.lower(MovieCast.person_name).like(search_term),
                func.lower(MovieCast.role_name).like(search_term)
            )
        )
        .distinct()
        .order_by(Movie.rating_avg.desc())
        .limit(limit)
    )
    movie_res = await db.execute(movie_stmt)
    movies = movie_res.scalars().all()

    # In-memory check for genres array if not found yet
    if len(movies) < limit:
        all_movies_res = await db.execute(select(Movie))
        for m in all_movies_res.scalars().all():
            if m.id not in [existing.id for existing in movies]:
                if any(q.lower() in g.lower() for g in (m.genres or [])):
                    movies.append(m)
                    if len(movies) >= limit:
                        break

    # 2. Search Cinemas (by name, address, or city name)
    cinema_stmt = (
        select(Cinema)
        .outerjoin(City, City.id == Cinema.city_id)
        .where(
            or_(
                func.lower(Cinema.name).like(search_term),
                func.lower(Cinema.address).like(search_term),
                func.lower(City.name).like(search_term)
            )
        )
        .distinct()
        .order_by(Cinema.name)
        .limit(limit)
    )
    cinema_res = await db.execute(cinema_stmt)
    cinemas = cinema_res.scalars().all()

    return {
        "query": q,
        "total_results": len(movies) + len(cinemas),
        "movies": [MovieResponse.model_validate(m) for m in movies],
        "cinemas": [CinemaResponse.model_validate(c) for c in cinemas]
    }
