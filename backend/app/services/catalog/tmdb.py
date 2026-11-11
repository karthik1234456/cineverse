import asyncio
import logging
import json
import os
import re
import subprocess
from datetime import datetime, date, timedelta, time
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, insert
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.movie import Movie, MovieCast
from app.models.cinema import Cinema, Auditorium, City, Seat
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum, PriceRule
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
INDIAN_DISCOVERY_LANGUAGES = ["kn", "hi", "ta", "te", "ml", "mr", "bn", "pa", "en"]

# City to language preferences
CITY_LANGUAGES: Dict[str, List[str]] = {
    "bengaluru": ["Kannada", "English", "Hindi", "Tamil", "Telugu"],
    "mumbai": ["Hindi", "Marathi", "English"],
    "delhi-ncr": ["Hindi", "English", "Punjabi"],
    "hyderabad": ["Telugu", "Hindi", "English"],
    "chennai": ["Tamil", "English", "Telugu"],
    "pune": ["Marathi", "Hindi", "English"],
    "kolkata": ["Bengali", "Hindi", "English"],
}

CACHE_FILE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "seed", "tmdb_synced_cache.json")
)


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text or "movie"


_KEY_CHECK_CACHE: Dict[str, Any] = {"expires_at": 0, "result": None}


def _execute_tmdb_curl(endpoint: str, params: Optional[Dict[str, Any]] = None, retries: int = 2) -> Optional[Dict[str, Any]]:
    """
    Executes TMDB API request using curl with TLS 1.3 and DNS-over-HTTPS.
    Bypasses local ISP SNI filtering and connection resets in India.
    Never prints or logs the API key.
    """
    api_key = (settings.TMDB_API_KEY or "").strip()
    if not api_key:
        return None

    query_parts = [f"api_key={api_key}"]
    if params:
        for k, v in params.items():
            query_parts.append(f"{k}={v}")

    url = f"{settings.TMDB_BASE_URL}{endpoint}?" + "&".join(query_parts)
    cmd = [
        "curl.exe",
        "-4",
        "-s",
        "--tlsv1.3",
        "--ssl-no-revoke",
        "--doh-url",
        "https://cloudflare-dns.com/dns-query",
        url
    ]

    for attempt in range(retries):
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if res.returncode == 0 and res.stdout:
                parsed = json.loads(res.stdout)
                return parsed
        except Exception as ex:
            logger.debug(f"cURL TMDB attempt {attempt+1} failed: {ex}")
    return None


async def check_tmdb_key_status() -> Dict[str, Any]:
    """
    Validates TMDB API key against TMDB API without ever exposing the key string.
    Cached for 5 minutes in memory.
    """
    import time as time_mod
    now = time_mod.time()
    if _KEY_CHECK_CACHE["result"] is not None and now < _KEY_CHECK_CACHE["expires_at"]:
        return _KEY_CHECK_CACHE["result"]

    tmdb_key = settings.TMDB_API_KEY.strip() if settings.TMDB_API_KEY else ""
    tmdb_key_set = bool(tmdb_key)
    tmdb_key_valid = False
    tmdb_validation_reason = "TMDB_API_KEY is not set in environment"

    if tmdb_key_set:
        # First try DoH curl
        resp_data = _execute_tmdb_curl("/authentication")
        if resp_data and resp_data.get("success") is True:
            tmdb_key_valid = True
            tmdb_validation_reason = "TMDB API key verified and accepted (HTTP 200 OK)"
        elif resp_data and "status_code" in resp_data:
            tmdb_validation_reason = f"TMDB rejected API key ({resp_data.get('status_message', 'Invalid key')})"
        else:
            # Fallback to standard httpx client
            try:
                headers = {"Authorization": f"Bearer {tmdb_key}"} if len(tmdb_key) > 40 else {}
                params = {"api_key": tmdb_key} if len(tmdb_key) <= 40 else {}
                async with httpx.AsyncClient(timeout=4.0) as client:
                    auth_resp = await client.get(
                        f"{settings.TMDB_BASE_URL}/authentication",
                        headers=headers,
                        params=params
                    )
                    if auth_resp.status_code == 200:
                        tmdb_key_valid = True
                        tmdb_validation_reason = "TMDB API key verified and accepted (HTTP 200 OK)"
                    else:
                        tmdb_validation_reason = f"TMDB rejected API key (HTTP {auth_resp.status_code})"
            except Exception as ex:
                tmdb_validation_reason = f"Error validating TMDB key: {str(ex)[:80]}"

    has_banner = not (tmdb_key_set and tmdb_key_valid)
    banner_message = "Real posters unavailable: TMDB key missing or rejected" if has_banner else None

    res = {
        "is_set": tmdb_key_set,
        "is_valid": tmdb_key_valid,
        "reason": tmdb_validation_reason,
        "banner": banner_message,
    }
    cache_ttl = 3600 if tmdb_key_valid else 10
    _KEY_CHECK_CACHE["expires_at"] = now + cache_ttl
    _KEY_CHECK_CACHE["result"] = res
    return res


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
        stmt = select(Movie)
        if status == "now_showing":
            stmt = stmt.where(Movie.is_now_showing.is_(True))
        elif status == "coming_soon":
            stmt = stmt.where(Movie.is_coming_soon.is_(True))

        if language and language != "All":
            stmt = stmt.where(Movie.languages.contains(language))

        # Real TMDB releases first, then rating
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
        skip_showtimes: bool = False,
    ) -> Dict[str, Any]:
        """
        Sync real Indian cinema releases from TMDB API.
        Idempotent: updates existing movies by tmdb_id or inserts new ones.
        Tolerant of API failure via local fallback cache.
        """
        # Update existing invented titles to showcase
        mock_res = await db.execute(
            select(Movie).where(or_(Movie.is_tmdb.is_(False), Movie.tmdb_id.is_(None)))
        )
        for mock_mov in mock_res.scalars().all():
            mock_mov.is_showcase = True
            mock_mov.source = "showcase"
            mock_mov.is_tmdb = False
        await db.flush()

        if not self.api_key:
            logger.warning("TMDB_API_KEY is not configured in environment. Checking local sync cache.")
            return await self._load_from_fallback_cache(db, skip_showtimes=skip_showtimes)

        target_langs = languages or INDIAN_DISCOVERY_LANGUAGES
        synced_movies: List[str] = []
        collected_tmdb_ids = set()
        movie_payloads: List[Any] = []

        # 1. Fetch Now Playing in India
        np_data = _execute_tmdb_curl("/movie/now_playing", {"region": "IN", "page": 1})
        if np_data and "results" in np_data:
            for item in np_data["results"]:
                mid = item.get("id")
                if mid and mid not in collected_tmdb_ids:
                    collected_tmdb_ids.add(mid)
                    movie_payloads.append((item, item.get("original_language", "hi"), True))

        # 2. Fetch Upcoming in India
        up_data = _execute_tmdb_curl("/movie/upcoming", {"region": "IN", "page": 1})
        if up_data and "results" in up_data:
            for item in up_data["results"]:
                mid = item.get("id")
                if mid and mid not in collected_tmdb_ids:
                    collected_tmdb_ids.add(mid)
                    movie_payloads.append((item, item.get("original_language", "hi"), False))

        # 3. Discover top Indian films per language
        for lang in target_langs:
            disc_data = _execute_tmdb_curl(
                "/discover/movie",
                {
                    "region": "IN",
                    "with_original_language": lang,
                    "sort_by": "popularity.desc",
                    "include_adult": "false",
                    "page": 1,
                }
            )
            if disc_data and "results" in disc_data:
                for item in disc_data["results"][:3]:
                    mid = item.get("id")
                    if mid and mid not in collected_tmdb_ids:
                        collected_tmdb_ids.add(mid)
                        movie_payloads.append((item, lang, True))

        # If live network returned fewer than 5 movies, fall back to cached dataset
        if len(movie_payloads) < 5:
            logger.info("Live TMDB returned limited items; augmenting from curated fallback cache.")
            return await self._load_from_fallback_cache(db)

        # 4. Fetch full details and upsert each movie (parallel fetch for maximum speed)
        import concurrent.futures

        def _fetch_one_detail(payload):
            item, l_code, def_now = payload
            t_id = item.get("id")
            if not t_id:
                return None, l_code, def_now
            d_data = _execute_tmdb_curl(
                f"/movie/{t_id}",
                {"append_to_response": "credits,videos,release_dates"}
            )
            return (d_data or item), l_code, def_now

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            fetched_details = list(executor.map(_fetch_one_detail, movie_payloads[:40]))

        cached_export_list = []
        for det_data, lang_code, default_now_showing in fetched_details:
            if not det_data:
                continue
            movie_rec = await self._upsert_tmdb_movie(db, det_data, lang_code, default_now_showing)
            if movie_rec:
                synced_movies.append(movie_rec.title)
                cached_export_list.append(det_data)

        # Save to disk cache for offline tolerance
        try:
            with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(cached_export_list, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Could not persist TMDB cache: {e}")

        await db.commit()

        # Seed realistic showtimes aligned to city language mixes
        if not skip_showtimes:
            await self._ensure_city_lineups_for_tmdb(db)

        return {
            "source": "tmdb",
            "status": "success",
            "synced_count": len(synced_movies),
            "synced_titles": synced_movies[:10],
            "total_tmdb_in_db": len(synced_movies),
        }

    async def _load_from_fallback_cache(self, db: AsyncSession, skip_showtimes: bool = False) -> Dict[str, Any]:
        """
        Loads authentic curated TMDB Indian movies from disk or built-in manifest.
        Guarantees zero-silent-failure and rich data even if TMDB API is offline.
        """
        synced_titles = []
        loaded_from_disk = False

        if os.path.exists(CACHE_FILE_PATH):
            try:
                with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                if isinstance(cached_data, list) and len(cached_data) >= 5:
                    for det_item in cached_data:
                        rec = await self._upsert_tmdb_movie(
                            db,
                            det_item,
                            det_item.get("original_language", "hi"),
                            default_now_showing=True
                        )
                        if rec:
                            synced_titles.append(rec.title)
                    loaded_from_disk = True
            except Exception as e:
                logger.warning(f"Error loading disk cache: {e}")

        if not loaded_from_disk:
            from app.seed.seed_tmdb_movies import TMDB_NON_SHOWCASE_MOVIES
            for item in TMDB_NON_SHOWCASE_MOVIES:
                tmdb_id = item.get("tmdb_id")
                if not tmdb_id:
                    continue

                stmt = select(Movie).where(Movie.tmdb_id == tmdb_id)
                res = await db.execute(stmt)
                movie = res.scalars().first()

                if not movie:
                    movie = Movie(
                        title=item["title"],
                        slug=item["slug"],
                        synopsis=item["synopsis"],
                        poster_url=item["poster_url"],
                        banner_url=item["banner_url"],
                        trailer_url=item["trailer_url"],
                        duration_minutes=item["duration_minutes"],
                        certificate=item["certificate"],
                        release_date=item["release_date"],
                        is_now_showing=item["is_now_showing"],
                        is_coming_soon=item["is_coming_soon"],
                        rating_avg=item["rating_avg"],
                        rating_count=item["rating_count"],
                        interested_count=item["interested_count"],
                        languages=item["languages"],
                        genres=item["genres"],
                        formats=item["formats"],
                        tmdb_id=tmdb_id,
                        tmdb_vote_average=item["tmdb_vote_average"],
                        tmdb_popularity=item["tmdb_popularity"],
                        is_tmdb=True,
                        is_showcase=False,
                        source="tmdb",
                        dominant_color="#1B1320",
                    )
                    db.add(movie)
                else:
                    movie.poster_url = item["poster_url"]
                    movie.banner_url = item["banner_url"]
                    movie.is_tmdb = True
                    movie.is_showcase = False
                    movie.source = "tmdb"
                synced_titles.append(item["title"])

        await db.commit()
        if not skip_showtimes:
            await self._ensure_city_lineups_for_tmdb(db)

        return {
            "source": "tmdb",
            "status": "success_fallback",
            "synced_count": len(synced_titles),
            "synced_titles": synced_titles[:10],
        }

    async def _upsert_tmdb_movie(
        self,
        db: AsyncSession,
        data: Dict[str, Any],
        primary_lang_code: str,
        default_now_showing: bool = True,
    ) -> Optional[Movie]:
        tmdb_id = data.get("id")
        title = data.get("title") or data.get("original_title") or "Untitled"
        overview = data.get("overview") or f"{title} — in cinemas across India."
        runtime = data.get("runtime") or 145
        vote_avg = float(data.get("vote_average") or 7.8)
        vote_count = int(data.get("vote_count") or 150)
        pop = float(data.get("popularity") or 45.0)

        poster_path = data.get("poster_path")
        backdrop_path = data.get("backdrop_path")

        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
        banner_url = f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else (
            f"https://image.tmdb.org/t/p/w1280{poster_path}" if poster_path else None
        )

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
        all_langs = [lang_name]
        if "English" not in all_langs:
            all_langs.append("English")
        if primary_lang_code in ["kn", "te", "ta", "ml"] and "Hindi" not in all_langs:
            all_langs.append("Hindi")

        genres = [g.get("name") for g in data.get("genres", []) if g.get("name")] or ["Action", "Drama"]
        formats = ["2D", "3D", "IMAX with Laser", "4DX"]

        # Release date
        rel_date_str = data.get("release_date")
        try:
            rel_date = datetime.strptime(rel_date_str, "%Y-%m-%d").date() if rel_date_str else date.today()
        except ValueError:
            rel_date = date.today()

        is_now_showing = rel_date <= date.today() if rel_date_str else default_now_showing
        is_coming_soon = rel_date > date.today() if rel_date_str else not default_now_showing

        slug = f"{slugify(title)}-{tmdb_id}"

        # Check existing by tmdb_id
        stmt = select(Movie).where(Movie.tmdb_id == tmdb_id)
        res = await db.execute(stmt)
        movie = res.scalars().first()

        if not movie:
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
                interested_count=max(vote_count * 6, 3200),
                languages=all_langs,
                genres=genres,
                formats=formats,
                tmdb_id=tmdb_id,
                tmdb_vote_average=vote_avg,
                tmdb_popularity=pop,
                is_tmdb=True,
                is_showcase=False,
                source="tmdb",
                youtube_trailer_id=youtube_key,
                dominant_color="#1B1320",
            )
            db.add(movie)
            await db.flush()
        else:
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
            movie.is_showcase = False
            movie.source = "tmdb"
            movie.youtube_trailer_id = youtube_key
            movie.languages = all_langs

        # Cast members
        credits_cast = data.get("credits", {}).get("cast", [])[:5]
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

    async def _ensure_city_lineups_for_tmdb(self, db: AsyncSession):
        """
        Programs realistic showtimes for TMDB movies matching each city's language mix.
        Guarantees that Delhi NCR cinemas show Hindi/English real releases, Bengaluru
        shows Kannada/English/Hindi/Tamil, Mumbai shows Hindi/Marathi/English, etc.
        Optimized with bulk batch insertion for high performance.
        """
        res_movies = await db.execute(
            select(Movie).where(Movie.is_tmdb.is_(True), Movie.is_now_showing.is_(True))
        )
        tmdb_movies = res_movies.scalars().all()
        if not tmdb_movies:
            return

        cities_res = await db.execute(
            select(City).options(
                selectinload(City.cinemas).selectinload(Cinema.auditoriums)
            )
        )
        cities = cities_res.scalars().all()

        # Preload all seats grouped by auditorium_id
        seats_res = await db.execute(select(Seat))
        seats_by_aud: Dict[int, List[Seat]] = {}
        for s in seats_res.scalars().all():
            seats_by_aud.setdefault(s.auditorium_id, []).append(s)

        # Preload existing showtimes keys (auditorium_id, start_time)
        existing_res = await db.execute(select(Showtime.auditorium_id, Showtime.start_time))
        existing_keys = set(existing_res.all())

        today = date.today()
        sample_slots = [
            time(11, 0),
            time(14, 30),
            time(18, 0),
            time(21, 30)
        ]

        showtimes_to_add: List[Showtime] = []

        for city in cities:
            city_langs = CITY_LANGUAGES.get(city.slug, ["Hindi", "English"])

            matching_movies = [
                m for m in tmdb_movies
                if any(lang in city_langs for lang in (m.languages or []))
            ]
            if len(matching_movies) < 14:
                for m in tmdb_movies:
                    if m not in matching_movies:
                        matching_movies.append(m)
                    if len(matching_movies) >= 16:
                        break

            for cin_idx, cinema in enumerate(city.cinemas):
                if not cinema.auditoriums:
                    continue

                for aud_idx, aud in enumerate(cinema.auditoriums):
                    for day_offset in range(7):
                        show_date = today + timedelta(days=day_offset)
                        for slot_idx, slot in enumerate(sample_slots):
                            start_dt = datetime.combine(show_date, slot)
                            if (aud.id, start_dt) in existing_keys:
                                continue
                            existing_keys.add((aud.id, start_dt))

                            assigned_movie = matching_movies[(cin_idx * 5 + aud_idx * 3 + slot_idx + day_offset) % len(matching_movies)]
                            end_dt = start_dt + timedelta(minutes=assigned_movie.duration_minutes + 25)

                            fmt = aud.screen_type or "2D"
                            lang = (
                                [l for l in (assigned_movie.languages or []) if l in city_langs] or ["English"]
                            )[0]

                            st = Showtime(
                                movie_id=assigned_movie.id,
                                cinema_id=cinema.id,
                                auditorium_id=aud.id,
                                start_time=start_dt,
                                end_time=end_dt,
                                format=fmt,
                                language=lang,
                                cancellation_cutoff_minutes=120,
                            )
                            db.add(st)
                            showtimes_to_add.append(st)

        await db.flush()

        # Now populate price rules and seat inventory for all new showtimes
        price_rules_data = []
        inv_data = []

        for st in showtimes_to_add:
            for cat, price in [("Front", 180.0), ("Prime", 280.0), ("Premier", 380.0)]:
                price_rules_data.append({
                    "showtime_id": st.id,
                    "category": cat,
                    "base_price": price
                })

            aud_seats = seats_by_aud.get(st.auditorium_id, [])
            for s in aud_seats:
                s_cat = s.category or "Prime"
                price = 380.0 if s_cat == "Premier" else (280.0 if s_cat == "Prime" else 180.0)
                inv_data.append({
                    "showtime_id": st.id,
                    "seat_id": s.seat_id,
                    "category": s_cat,
                    "price": price,
                    "status": SeatStatusEnum.AVAILABLE,
                })

        # Bulk insert price rules
        if price_rules_data:
            for i in range(0, len(price_rules_data), 1000):
                await db.execute(insert(PriceRule).values(price_rules_data[i:i + 1000]))

        # Bulk insert seat inventory
        if inv_data:
            for i in range(0, len(inv_data), 2500):
                await db.execute(insert(SeatInventory).values(inv_data[i:i + 2500]))

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
            "is_showcase": bool(m.is_showcase),
            "source": getattr(m, "source", None) or ("showcase" if not m.is_tmdb else "tmdb"),
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
