from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.movie import Movie, MovieCast
from app.models.cinema import Cinema, City
from app.schemas.movie import MovieResponse
from app.schemas.cinema import CinemaResponse

router = APIRouter()


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    search_term = f"%{q.lower().strip()}%"

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
