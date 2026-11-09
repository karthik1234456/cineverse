import asyncio
import logging
import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.movie import Movie, MovieCast
from app.models.cinema import Cinema, Auditorium
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.services.catalog.base import CatalogProvider

logger = logging.getLogger("cineverse.catalog.tmdb")

# Language code to display name mapping
LANGUAGE_MAP: Dict[str, str] = {
    "kn": "Kannada",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "ml": "Malayalam",
    "bn": "Bengali",
    "mr": "Marathi",
    "pa": "Punjabi",
    "en": "English",
}

# Supported Indian discovery languages
INDIAN_DISCOVERY_LANGUAGES = ["kn", "hi", "ta", "te", "ml", "bn", "mr", "pa", "en"]


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text or "movie"


class TMDBCatalogProvider(CatalogProvider):
    """
    TMDB Catalog Provider for real Indian movie releases.
    Uses server-side TMDB API key strictly; never exposed to browser or client code.
    Idempotent, rate-limited, and cached.
    """

    def __init__(self):
        self.api_key = settings.TMDB_API_KEY
        self.base_url = settings.TMDB_BASE_URL
        self.img_base = settings.TMDB_IMAGE_BASE_URL
        self._memory_cache: Dict[str, Any] = {}

    @property
    def source_name(self) -> str:
        return "tmdb"

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
        """
        Query movies from DB. TMDB movies have `is_tmdb=True` or `tmdb_id IS NOT NULL`.
        Falls back to local movies if none exist yet.
        """
        stmt = select(Movie)
        if status == "now_showing":
            stmt = stmt.where(Movie.is_now_showing.is_(True))
        elif status == "coming_soon":
            stmt = stmt.where(Movie.is_coming_soon.is_(True))

        if language and language != "All":
            stmt = stmt.where(Movie.languages.contains(language))

        # Order by TMDB popularity or rating if present
        stmt = stmt.order_by(Movie.is_tmdb.desc(), Movie.rating_avg.desc()).limit(limit)
        res = await db.execute(stmt)
        movies = res.scalars().all()

        return [self._movie_to_dict(m) for m in movies]

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
        """
        Sync real Indian cinema releases from TMDB API.
        Idempotent: updates existing movies by tmdb_id or inserts new ones.
        """
        if not self.api_key:
            logger.warning("TMDB_API_KEY is not configured in environment. Skipping remote sync.")
            return {
                "source": "tmdb",
                "status": "skipped",
                "message": "TMDB_API_KEY not configured. Add TMDB_API_KEY to backend/.env",
                "synced_count": 0,
            }

        target_langs = languages or INDIAN_DISCOVERY_LANGUAGES
        synced_movies = []
        errors = []

        headers = {
            "Authorization": f"Bearer {self.api_key}" if len(self.api_key) > 40 else "",
            "Accept": "application/json",
        }
        params_auth = {}
        if len(self.api_key) <= 40:
            params_auth["api_key"] = self.api_key

        async with httpx.AsyncClient(timeout=15.0) as client:
            for lang in target_langs:
                try:
                    # 1. Discover now playing / popular in India for this language
                    url = f"{self.base_url}/discover/movie"
                    params = {
                        **params_auth,
                        "region": "IN",
                        "with_original_language": lang,
                        "sort_by": "popularity.desc",
                        "include_adult": "false",
                        "page": 1,
                    }
                    resp = await client.get(url, params=params, headers=headers)
                    if resp.status_code != 200:
                        errors.append(f"Lang {lang}: HTTP {resp.status_code} {resp.text[:100]}")
                        continue

                    data = resp.json()
                    results = data.get("results", [])[:4]  # Top 4 per language

                    for item in results:
                        tmdb_id = item.get("id")
                        if not tmdb_id:
                            continue

                        # Rate limiting gentleness
                        await asyncio.sleep(0.1)

                        # Fetch full movie details with credits, videos, and release_dates
                        det_url = f"{self.base_url}/movie/{tmdb_id}"
                        det_params = {
                            **params_auth,
                            "append_to_response": "credits,videos,release_dates",
                        }
                        det_resp = await client.get(det_url, params=det_params, headers=headers)
                        if det_resp.status_code != 200:
                            continue

                        det_data = det_resp.json()
                        movie_rec = await self._upsert_tmdb_movie(db, det_data, lang)
                        if movie_rec:
                            synced_movies.append(movie_rec.title)

                except Exception as ex:
                    logger.error(f"Error syncing TMDB language {lang}: {ex}")
                    errors.append(f"{lang}: {str(ex)}")

        await db.commit()

        # Seed sample showtimes for newly synced movies if they have none
        await self._ensure_sample_showtimes_for_tmdb(db)

        return {
            "source": "tmdb",
            "status": "success" if synced_movies else "partial",
            "synced_count": len(synced_movies),
            "synced_titles": synced_movies[:10],
            "languages_processed": target_langs,
            "errors": errors,
        }

    async def _upsert_tmdb_movie(
        self,
        db: AsyncSession,
        data: Dict[str, Any],
        primary_lang_code: str,
    ) -> Optional[Movie]:
        tmdb_id = data.get("id")
        title = data.get("title") or data.get("original_title") or "Untitled"
        overview = data.get("overview") or f"{title} - In Cinemas Now."
        runtime = data.get("runtime") or 145
        vote_avg = float(data.get("vote_average") or 8.0)
        vote_count = int(data.get("vote_count") or 100)
        pop = float(data.get("popularity") or 50.0)

        poster_path = data.get("poster_path")
        backdrop_path = data.get("backdrop_path")

        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
        banner_url = f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else None

        # Extract YouTube trailer
        videos = data.get("videos", {}).get("results", [])
        youtube_key = None
        for v in videos:
            if v.get("site") == "YouTube" and v.get("type") in ["Trailer", "Teaser"]:
                youtube_key = v.get("key")
                break
        if not youtube_key and videos:
            youtube_key = videos[0].get("key")

        trailer_url = f"https://www.youtube-nocookie.com/embed/{youtube_key}" if youtube_key else None

        # Extract Indian certification (CBFC)
        cert = "UA"
        rel_results = data.get("release_dates", {}).get("results", [])
        for r in rel_results:
            if r.get("iso_3166_1") == "IN":
                dates_list = r.get("release_dates", [])
                for d_item in dates_list:
                    c = d_item.get("certification", "").strip().upper()
                    if c in ["U", "UA", "A", "U/A"]:
                        cert = "UA" if c in ["UA", "U/A"] else c
                        break

        # Languages and genres
        lang_name = LANGUAGE_MAP.get(primary_lang_code, "Hindi")
        genres = [g.get("name") for g in data.get("genres", []) if g.get("name")] or ["Action", "Drama"]
        formats = ["2D", "3D", "IMAX 3D"]

        # Release date
        rel_date_str = data.get("release_date")
        try:
            rel_date = datetime.strptime(rel_date_str, "%Y-%m-%d").date() if rel_date_str else date.today()
        except ValueError:
            rel_date = date.today()

        is_now_showing = rel_date <= date.today()
        is_coming_soon = rel_date > date.today()

        slug = f"{slugify(title)}-{tmdb_id}"

        # Check existing by tmdb_id
        stmt = select(Movie).where(Movie.tmdb_id == tmdb_id)
        res = await db.execute(stmt)
        movie = res.scalars().first()

        if not movie:
            # Check by slug
            stmt_slug = select(Movie).where(Movie.slug == slug)
            res_slug = await db.execute(stmt_slug)
            movie = res_slug.scalars().first()

        if not movie:
            movie = Movie(
                title=title,
                slug=slug,
                synopsis=overview,
                poster_url=poster_url,
                banner_url=banner_url,
                trailer_url=trailer_url,
                duration_minutes=runtime,
                certificate=cert,
                release_date=rel_date,
                is_now_showing=is_now_showing,
                is_coming_soon=is_coming_soon,
                rating_avg=vote_avg,
                rating_count=vote_count,
                interested_count=max(vote_count * 5, 2500),
                languages=[lang_name],
                genres=genres,
                formats=formats,
                tmdb_id=tmdb_id,
                tmdb_vote_average=vote_avg,
                tmdb_popularity=pop,
                is_tmdb=True,
                youtube_trailer_id=youtube_key,
                dominant_color="#1B1320",
            )
            db.add(movie)
            await db.flush()
        else:
            # Update fields
            movie.title = title
            movie.synopsis = overview
            movie.poster_url = poster_url
            movie.banner_url = banner_url
            if trailer_url:
                movie.trailer_url = trailer_url
            movie.rating_avg = vote_avg
            movie.rating_count = vote_count
            movie.tmdb_vote_average = vote_avg
            movie.tmdb_popularity = pop
            movie.is_tmdb = True
            movie.youtube_trailer_id = youtube_key

        # Cast members
        credits_cast = data.get("credits", {}).get("cast", [])[:5]
        # Remove existing cast
        stmt_cast = select(MovieCast).where(MovieCast.movie_id == movie.id)
        cast_res = await db.execute(stmt_cast)
        for old_c in cast_res.scalars().all():
            await db.delete(old_c)

        for c_item in credits_cast:
            name = c_item.get("name")
            char_name = c_item.get("character") or "Lead Cast"
            prof_path = c_item.get("profile_path")
            photo = f"https://image.tmdb.org/t/p/w185{prof_path}" if prof_path else None
            db.add(MovieCast(
                movie_id=movie.id,
                person_name=name,
                role_name=char_name,
                photo_url=photo,
                category="Cast",
            ))

        return movie

    async def _ensure_sample_showtimes_for_tmdb(self, db: AsyncSession):
        """
        Creates sample demonstration showtimes for TMDB movies so users can test booking.
        """
        res_movies = await db.execute(select(Movie).where(Movie.is_tmdb.is_(True)))
        tmdb_movies = res_movies.scalars().all()

        res_cinemas = await db.execute(select(Cinema).options(selectinload(Cinema.auditoriums)))
        cinemas = res_cinemas.scalars().all()
        if not cinemas:
            return

        today_str = date.today().isoformat()
        sample_hours = ["11:00", "14:30", "18:00", "21:30"]

        for m in tmdb_movies:
            # Check if movie already has showtimes
            st_check = await db.execute(select(Showtime).where(Showtime.movie_id == m.id))
            if st_check.scalars().first():
                continue

            # Assign to 1-2 cinemas with sample showtimes
            for cin in cinemas[:2]:
                if not cin.auditoriums:
                    continue
                aud = cin.auditoriums[0]
                for h in sample_hours:
                    start_dt = datetime.fromisoformat(f"{today_str}T{h}:00")
                    end_dt = datetime.fromisoformat(f"{today_str}T{int(h[:2])+2}:30:00")
                    st = Showtime(
                        movie_id=m.id,
                        cinema_id=cin.id,
                        auditorium_id=aud.id,
                        start_time=start_dt,
                        end_time=end_dt,
                        format=m.formats[0] if m.formats else "2D",
                        language=m.languages[0] if m.languages else "English",
                        lowest_price=250.0,
                        availability_status="AVAILABLE",
                        available_seat_count=85,
                        total_seat_count=100,
                    )
                    db.add(st)
                    await db.flush()

                    # Create standard seat inventory
                    rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
                    for r in rows:
                        for n in range(1, 11):
                            s_id = f"{r}{str(n).zfill(2)}"
                            cat = "Premier" if r in ["A", "B", "C"] else "Prime" if r in ["D", "E", "F", "G"] else "Front"
                            price = 380.0 if cat == "Premier" else 280.0 if cat == "Prime" else 180.0
                            db.add(SeatInventory(
                                showtime_id=st.id,
                                seat_id=s_id,
                                category=cat,
                                price=price,
                                status=SeatStatusEnum.AVAILABLE,
                            ))
        await db.commit()

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

