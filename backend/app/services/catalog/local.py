from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.models.movie import Movie
from app.models.showtime import Showtime
from app.models.cinema import Cinema
from app.services.catalog.base import CatalogProvider


class LocalCatalogProvider(CatalogProvider):
    """
    Standard Local/Seeder Catalog Provider.
    Queries the existing seeded movies in SQLite/PostgreSQL.
    """

    @property
    def source_name(self) -> str:
        return "local"

    async def get_movies(
        self,
        db: AsyncSession,
        city_id: Optional[int] = None,
        language: Optional[str] = None,
        genre: Optional[str] = None,
        format_filter: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        stmt = select(Movie)
        if city_id:
            if status == "now_showing":
                stmt = stmt.join(Showtime, Showtime.movie_id == Movie.id)\
                           .join(Cinema, Cinema.id == Showtime.cinema_id)\
                           .where(Cinema.city_id == city_id)\
                           .distinct()
            elif status == "coming_soon":
                stmt = stmt.where(Movie.is_coming_soon.is_(True))
            else:
                stmt = stmt.outerjoin(Showtime, Showtime.movie_id == Movie.id)\
                           .outerjoin(Cinema, Cinema.id == Showtime.cinema_id)\
                           .where(
                               or_(
                                   Cinema.city_id == city_id,
                                   Movie.is_coming_soon.is_(True)
                               )
                           ).distinct()

        if status == "now_showing":
            stmt = stmt.where(Movie.is_now_showing.is_(True))
        elif status == "coming_soon":
            stmt = stmt.where(Movie.is_coming_soon.is_(True))

        stmt = stmt.limit(limit)
        res = await db.execute(stmt)
        movies = res.scalars().all()
        filtered = []
        for m in movies:
            # Rule: Hide real titles without posters from Now Showing
            if m.is_tmdb and not (m.poster_url and m.poster_url.strip()):
                if status == "now_showing":
                    continue
            filtered.append(m)
        return [self._movie_to_dict(m) for m in filtered]

    async def get_movie_detail(
        self,
        db: AsyncSession,
        movie_id_or_slug: str,
    ) -> Optional[Dict[str, Any]]:
        stmt = select(Movie).options(
            selectinload(Movie.cast_members),
            selectinload(Movie.reviews)
        )
        if movie_id_or_slug.isdigit():
            stmt = stmt.where(Movie.id == int(movie_id_or_slug))
        else:
            stmt = stmt.where(Movie.slug == movie_id_or_slug)

        res = await db.execute(stmt)
        movie = res.scalars().first()
        if not movie:
            return None
        return self._movie_to_dict(movie, include_details=True)

    async def sync_catalog(
        self,
        db: AsyncSession,
        languages: Optional[List[str]] = None,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """Local catalog sync is a no-op since data is already seeded."""
        res = await db.execute(select(Movie))
        count = len(res.scalars().all())
        return {
            "source": "local",
            "movies_count": count,
            "status": "ready",
            "message": "Local catalog is active from seeded database."
        }

    def _movie_to_dict(self, m: Movie, include_details: bool = False) -> Dict[str, Any]:
        data = {
            "id": m.id,
            "title": m.title,
            "slug": m.slug,
            "synopsis": m.synopsis,
            "poster_url": m.poster_url,
            "banner_url": m.banner_url,
            "trailer_url": m.trailer_url,
            "trailer_duration_seconds": m.trailer_duration_seconds,
            "trailer_poster_frame_url": m.trailer_poster_frame_url,
            "trailer_captions_url": m.trailer_captions_url,
            "dominant_color": m.dominant_color,
            "glimpse_url": m.glimpse_url,
            "glimpse_webm_url": m.glimpse_webm_url,
            "glimpse_720p_url": m.glimpse_720p_url,
            "duration_minutes": m.duration_minutes,
            "certificate": m.certificate,
            "release_date": str(m.release_date),
            "is_now_showing": m.is_now_showing,
            "is_coming_soon": m.is_coming_soon,
            "rating_avg": m.rating_avg,
            "rating_count": m.rating_count,
            "interested_count": m.interested_count,
            "languages": m.languages or [],
            "genres": m.genres or [],
            "formats": m.formats or [],
            "tmdb_id": m.tmdb_id,
            "tmdb_vote_average": m.tmdb_vote_average,
            "tmdb_popularity": m.tmdb_popularity,
            "is_tmdb": bool(m.is_tmdb),
            "youtube_trailer_id": m.youtube_trailer_id,
        }
        if include_details:
            data["cast_members"] = [
                {
                    "id": c.id,
                    "person_name": c.person_name,
                    "role_name": c.role_name,
                    "photo_url": c.photo_url,
                    "category": c.category
                }
                for c in (m.cast_members or [])
            ]
            data["reviews"] = [
                {
                    "id": r.id,
                    "movie_id": r.movie_id,
                    "user_id": r.user_id,
                    "rating": r.rating,
                    "headline": r.headline,
                    "content": r.content,
                    "has_spoilers": r.has_spoilers,
                    "created_at": str(r.created_at),
                }
                for r in (m.reviews or [])
            ]
        return data

