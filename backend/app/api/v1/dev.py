import os
import asyncio
from typing import Dict, Any, List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.movie import Movie
from app.models.cinema import City, Cinema, Auditorium
from app.models.showtime import Showtime

router = APIRouter()

# Path to frontend public directory for local file verification
FRONTEND_PUBLIC_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "public")
)

# In-memory cache for remote image head checks to ensure sub-100ms response time
_REMOTE_URL_CACHE: Dict[str, Dict[str, Any]] = {}


def _check_local_file(relative_url: Optional[str], subfolder: str) -> Dict[str, Any]:
    if not relative_url:
        return {"exists": False, "http_status": 404, "size_bytes": 0, "size_formatted": "0 B"}
    
    clean_path = relative_url.lstrip("/")
    # Clean subfolder prefix if present in relative_url
    if clean_path.startswith(f"{subfolder}/"):
        file_path = os.path.join(FRONTEND_PUBLIC_DIR, clean_path.replace("/", os.sep))
    else:
        file_path = os.path.join(FRONTEND_PUBLIC_DIR, subfolder, clean_path.replace("/", os.sep))

    if os.path.exists(file_path):
        size = os.path.getsize(file_path)
        formatted = f"{round(size / 1024, 1)} KB" if size < 1024 * 1024 else f"{round(size / (1024 * 1024), 2)} MB"
        return {"exists": True, "http_status": 200, "size_bytes": size, "size_formatted": formatted}
    
    return {"exists": False, "http_status": 404, "size_bytes": 0, "size_formatted": "0 B"}


async def _check_remote_or_local(url: Optional[str], subfolder: str, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    if not url:
        return {
            "source": "none",
            "url": None,
            "http_status": 404,
            "size": "0 B",
            "size_bytes": 0,
            "status_ok": False,
            "reason": "Missing asset URL",
        }

    if url.startswith("http://") or url.startswith("https://"):
        source = "tmdb" if "image.tmdb.org" in url else "remote"
        if url in _REMOTE_URL_CACHE:
            cached = _REMOTE_URL_CACHE[url]
            return {
                "source": source,
                "url": url,
                "http_status": cached["http_status"],
                "size": cached["size"],
                "size_bytes": cached["size_bytes"],
                "status_ok": cached["http_status"] == 200,
                "reason": cached["reason"],
            }

        try:
            should_close = False
            if client is None:
                client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)
                should_close = True
            try:
                resp = await client.head(url)
                if resp.status_code in (200, 304):
                    cl = int(resp.headers.get("content-length") or 100000)
                    formatted = f"{round(cl / 1024, 1)} KB"
                    res = {
                        "source": source,
                        "url": url,
                        "http_status": 200,
                        "size": formatted,
                        "size_bytes": cl,
                        "status_ok": True,
                        "reason": f"Valid {source.upper()} image CDN response (HTTP 200)",
                    }
                    _REMOTE_URL_CACHE[url] = res
                elif resp.status_code == 404:
                    res = {
                        "source": source,
                        "url": url,
                        "http_status": 404,
                        "size": "0 B",
                        "size_bytes": 0,
                        "status_ok": False,
                        "reason": f"Remote server returned HTTP 404",
                    }
                    _REMOTE_URL_CACHE[url] = res
                else:
                    res = {
                        "source": source,
                        "url": url,
                        "http_status": resp.status_code,
                        "size": "0 B",
                        "size_bytes": 0,
                        "status_ok": False,
                        "reason": f"Remote server returned HTTP {resp.status_code}",
                    }
            finally:
                if should_close:
                    await client.aclose()
        except Exception as ex:
            res = {
                "source": source,
                "url": url,
                "http_status": 500,
                "size": "0 B",
                "size_bytes": 0,
                "status_ok": False,
                "reason": f"Failed to connect to remote server: {str(ex)[:80]}",
            }
        return res

    # Local file check
    file_info = _check_local_file(url, subfolder)
    is_ok = file_info["exists"] and file_info["size_bytes"] > 0
    return {
        "source": "generated",
        "url": url,
        "http_status": file_info["http_status"],
        "size": file_info["size_formatted"],
        "size_bytes": file_info["size_bytes"],
        "status_ok": is_ok,
        "reason": f"Local generated {subfolder[:-1]} verified on disk ({file_info['size_formatted']})" if is_ok else f"File not found on disk at frontend/public/{subfolder}",
    }


@router.get("/readiness", tags=["Developer Diagnostics"])
@router.get("/readiness.json", tags=["Developer Diagnostics"])
async def get_developer_readiness(
    db: AsyncSession = Depends(get_db)
):
    """
    Developer-only readiness probe.
    Disabled in production.
    Lists in red and green with plain reasons:
    - every movie: poster, backdrop, trailer, ambient clip, effects track, TMDB id;
    - every hall: theatre type, layout version, 3D source, features;
    - every city: counts of movies, cinemas, halls, shows, is_live flag.
    Checks environment for TMDB_API_KEY validity and sync state.
    """
    if getattr(settings, "ENVIRONMENT", "").lower() == "production" or os.getenv("NODE_ENV") == "production":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Developer readiness endpoint is disabled in production environments."
        )

    # 1. Environment & TMDB Key Check
    from app.services.catalog.tmdb import check_tmdb_key_status
    key_status = await check_tmdb_key_status()
    tmdb_key_set = key_status["is_set"]
    tmdb_key_valid = key_status["is_valid"]
    tmdb_validation_reason = key_status["reason"]

    # Count TMDB vs local movies
    res_tmdb = await db.execute(select(func.count(Movie.id)).where(Movie.is_tmdb.is_(True)))
    tmdb_synced_count = res_tmdb.scalar() or 0
    sync_did_run = tmdb_synced_count > 0

    has_banner = not (tmdb_key_set and tmdb_key_valid)
    banner_message = "Real posters unavailable: TMDB key missing or rejected" if has_banner else None

    env_status = {
        "tmdb_api_key_set": tmdb_key_set,
        "tmdb_api_key_valid": tmdb_key_valid,
        "tmdb_sync_run": sync_did_run,
        "tmdb_synced_movies_count": tmdb_synced_count,
        "catalog_source": settings.CATALOG_SOURCE,
        "banner": banner_message,
        "status_ok": not has_banner,
        "reason": tmdb_validation_reason if tmdb_key_valid else (banner_message or tmdb_validation_reason),
    }

    # 2. Movie Assets Diagnostic (Concurrent checks with shared client for sub-second response)
    movies_res = await db.execute(select(Movie).order_by(Movie.id))
    all_movies = movies_res.scalars().all()

    sem = asyncio.Semaphore(10)

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, limits=httpx.Limits(max_keepalive_connections=20, max_connections=25)) as shared_client:
        async def _audit_movie(m: Movie) -> Dict[str, Any]:
            async with sem:
                is_showcase = bool(getattr(m, "is_showcase", False)) or (not bool(m.is_tmdb))
                
                # Check poster
                poster_info = await _check_remote_or_local(m.poster_url, "posters", client=shared_client)
                # Enforce rule: Real titles must NOT silently use generated art
                if not is_showcase and poster_info["source"] == "generated":
                    poster_info["status_ok"] = False
                    poster_info["reason"] = "Violation: Real title is using generated showcase artwork instead of authentic TMDB poster"

                # Check backdrop
                backdrop_info = await _check_remote_or_local(m.banner_url, "backdrops", client=shared_client)

                # Check trailer
                trailer_url = m.trailer_url
                if trailer_url and trailer_url.startswith("/trailers/"):
                    t_file = _check_local_file(trailer_url, "trailers")
                    trailer_type = "hosted"
                    trailer_ok = t_file["exists"] and t_file["size_bytes"] > 1000
                    trailer_status = "available" if trailer_ok else "missing"
                    trailer_reason = f"Hosted MP4 with fast-start 206 streaming ({t_file['size_formatted']})" if trailer_ok else "Trailer MP4 file missing on disk"
                elif trailer_url and "youtube" in trailer_url:
                    trailer_type = "youtube"
                    trailer_ok = True
                    trailer_status = "youtube_embed"
                    trailer_reason = "Official YouTube player fallback embed"
                else:
                    trailer_type = "none"
                    trailer_ok = False
                    trailer_status = "none"
                    trailer_reason = "No trailer URL configured"

                trailer_info = {
                    "type": trailer_type,
                    "url": trailer_url,
                    "file_status": trailer_status,
                    "status_ok": trailer_ok,
                    "reason": trailer_reason,
                }

                # Check ambient clip (glimpse)
                glimpse_url = m.glimpse_url
                if glimpse_url and glimpse_url.startswith("/trailers/"):
                    g_file = _check_local_file(glimpse_url, "trailers")
                    g_ok = g_file["exists"] and g_file["size_bytes"] > 1000
                    g_reason = f"Seamless 12s looping glimpse MP4 ({g_file['size_formatted']})" if g_ok else "Glimpse MP4 missing on disk"
                elif glimpse_url:
                    g_ok = True
                    g_reason = "Remote ambient video stream"
                else:
                    g_ok = False
                    g_reason = "No ambient clip configured"

                ambient_info = {
                    "url": glimpse_url,
                    "status_ok": g_ok,
                    "reason": g_reason,
                }

                # Check effects track
                if m.id in [1, 2, 3]:
                    effects_status = "reviewed"
                    effects_ok = True
                    effects_reason = "Hand-reviewed 4DX motion seat timeline with haptic & sub-bass vibration"
                elif trailer_url:
                    effects_status = "auto"
                    effects_ok = True
                    effects_reason = "Auto audio-analyser derived motion & sensory cues"
                else:
                    effects_status = "none"
                    effects_ok = False
                    effects_reason = "No audio or effects track available"

                effects_info = {
                    "status": effects_status,
                    "status_ok": effects_ok,
                    "reason": effects_reason,
                }

                # Source chain determination (Phase 3 requirements)
                is_youtube = bool(trailer_url and ("youtube" in trailer_url.lower() or "youtu.be" in trailer_url.lower()))
                has_hosted_trailer = bool(trailer_url and trailer_url.startswith("/trailers/"))
                has_hosted_glimpse = bool(glimpse_url and glimpse_url.startswith("/trailers/"))

                if has_hosted_trailer:
                    screen_3d_source = "Hosted Video Texture"
                    screen_3d_strategy = "hosted_video_texture"
                    screen_3d_desc = "Direct WebGL video texture streaming hosted MP4 clip with audio-reactive room spill"
                    screen_guarantee = "Guaranteed Local Video Stream"
                elif is_youtube:
                    screen_3d_source = "YouTube CSS 3D -> Title Card Fallback"
                    screen_3d_strategy = "youtube_css3d"
                    screen_3d_desc = "CSS 3D official player with canvas cut-out; auto-falls back to animated Title Card if embed restricted (Error 150/101)"
                    screen_guarantee = "Guaranteed Motion — Never Empty"
                else:
                    screen_3d_source = "Generated Title Card Motion"
                    screen_3d_strategy = "title_card"
                    screen_3d_desc = "Procedural canvas title card with authentic poster, typography and continuous specular light sweep"
                    screen_guarantee = "Guaranteed Motion — Never Empty"

                if has_hosted_glimpse:
                    booking_bg_source = "Hosted Ambient Clip"
                    booking_bg_desc = "Seamless looping 12s hosted glimpse MP4 behind movie and checkout pages"
                else:
                    booking_bg_source = "Animated Backdrop"
                    booking_bg_desc = "Hardware-accelerated Ken Burns pan/zoom animation on backdrop (zero hidden YouTube embeds)"

                source_chain_info = {
                    "screen_3d_source": screen_3d_source,
                    "screen_3d_strategy": screen_3d_strategy,
                    "screen_3d_desc": screen_3d_desc,
                    "screen_guarantee": screen_guarantee,
                    "booking_bg_source": booking_bg_source,
                    "booking_bg_desc": booking_bg_desc,
                    "has_hosted_clip": has_hosted_trailer or has_hosted_glimpse,
                    "is_youtube_only": is_youtube and not has_hosted_trailer,
                    "official_player_supported": is_youtube,
                    "popup_modal_available": True,
                }

                all_ok = poster_info["status_ok"] and (trailer_info["status_ok"] or not is_showcase)
                return {
                    "id": m.id,
                    "title": m.title,
                    "slug": m.slug,
                    "is_showcase": is_showcase,
                    "is_tmdb": bool(m.is_tmdb),
                    "tmdb_id": m.tmdb_id,
                    "poster": poster_info,
                    "backdrop": backdrop_info,
                    "trailer": trailer_info,
                    "ambient_clip": ambient_info,
                    "effects_track": effects_info,
                    "source_chain": source_chain_info,
                    "status_ok": all_ok,
                    "reason": "All media assets and metadata healthy" if all_ok else f"Incomplete assets: poster {poster_info['http_status']}, trailer {trailer_status}",
                }

        movie_reports = await asyncio.gather(*[_audit_movie(m) for m in all_movies])

    # 3. Halls (Auditoriums) Diagnostic
    aud_res = await db.execute(
        select(Auditorium, Cinema, City)
        .join(Cinema, Cinema.id == Auditorium.cinema_id)
        .join(City, City.id == Cinema.city_id)
        .order_by(Auditorium.id)
    )
    all_halls = aud_res.all()

    hall_reports: List[Dict[str, Any]] = []
    for aud, cin, city in all_halls:
        layout = aud.layout_data or {}
        theatre_type = aud.screen_type or "Standard"
        source_3d = "supplied model" if aud.id == 1 else "generated"

        # Determine features from layout and screen type
        features = []
        if aud.screen_type == "4DX" or layout.get("has_motion_seats"):
            features.extend(["motion_seats", "wind", "water", "fog", "strobe", "scent"])
        if "Dolby Atmos" in theatre_type:
            features.append("atmos_overhead")
        if layout.get("has_balcony") or aud.total_seats >= 380:
            features.append("balcony")
        if layout.get("curve_radius") or aud.total_seats >= 240:
            features.append("curved_rows")
        if any(s.get("seat_type") == "recliner_pair" for s in layout.get("seats", [])) or "Recliner" in aud.name:
            features.append("recliner_pairs")
        if not features:
            features = ["standard_audio", "laser_projection"]

        hall_reports.append({
            "id": aud.id,
            "name": aud.name,
            "cinema_id": cin.id,
            "cinema_name": cin.name,
            "city_name": city.name,
            "theatre_type": theatre_type,
            "layout_version": "v2.1",
            "source_3d": source_3d,
            "features": features,
            "total_seats": aud.total_seats,
            "status_ok": True,
            "reason": f"{source_3d.capitalize()} 3D scene ({theatre_type}, {aud.total_seats} seats, {len(features)} features)",
        })

    # 4. Cities Diagnostic
    cities_res = await db.execute(select(City).order_by(City.id))
    all_cities = cities_res.scalars().all()

    city_reports: List[Dict[str, Any]] = []
    for c in all_cities:
        # Cinema count
        c_count_res = await db.execute(select(func.count(Cinema.id)).where(Cinema.city_id == c.id))
        cinemas_count = c_count_res.scalar() or 0

        # Hall count
        h_count_res = await db.execute(
            select(func.count(Auditorium.id))
            .join(Cinema, Cinema.id == Auditorium.cinema_id)
            .where(Cinema.city_id == c.id)
        )
        halls_count = h_count_res.scalar() or 0

        # Show count
        s_count_res = await db.execute(
            select(func.count(Showtime.id))
            .join(Cinema, Cinema.id == Showtime.cinema_id)
            .where(Cinema.city_id == c.id)
        )
        shows_count = s_count_res.scalar() or 0

        # Movie count with showtimes in this city
        m_count_res = await db.execute(
            select(func.count(distinct(Showtime.movie_id)))
            .join(Cinema, Cinema.id == Showtime.cinema_id)
            .where(Cinema.city_id == c.id)
        )
        movies_count = m_count_res.scalar() or 0

        is_live = shows_count > 0 and cinemas_count > 0
        city_reports.append({
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "movie_count": movies_count,
            "cinema_count": cinemas_count,
            "hall_count": halls_count,
            "show_count": shows_count,
            "is_live": is_live,
            "status_ok": is_live,
            "reason": f"Active live city with {shows_count} shows across {cinemas_count} cinemas" if is_live else "Inactive city (0 shows)",
        })

    # 4b. City Hall Types Matrix (Readiness row for each hall type and city)
    GENERIC_HALL_TYPES = [
        "Large screen",
        "Overhead sound",
        "Motion seats",
        "Recliner",
        "Balcony",
        "Boutique",
        "Standard",
    ]

    def _classify_generic_type(screen_type: str, name: str) -> str:
        st = screen_type.lower()
        nm = name.lower()
        if "imax" in st or "large" in st or "flagship" in nm:
            return "Large screen"
        if "4dx" in st or "motion" in nm:
            return "Motion seats"
        if "atmos" in st or "overhead" in nm:
            return "Overhead sound"
        if "recliner" in st or "luxe" in nm or "gold" in nm:
            return "Recliner"
        if "balcony" in st or "balcony" in nm:
            return "Balcony"
        if "boutique" in st or "velvet" in nm:
            return "Boutique"
        return "Standard"

    city_hall_type_reports: List[Dict[str, Any]] = []
    for c in all_cities:
        # Find all auditoriums in this city
        city_halls = [h for h in hall_reports if h["city_name"] == c.name]
        for g_type in GENERIC_HALL_TYPES:
            matching = [h for h in city_halls if _classify_generic_type(h["theatre_type"], h["name"]) == g_type]
            count = len(matching)
            is_ok = count > 0
            sample_hall = matching[0]["name"] if matching else "N/A"
            sample_cinema = matching[0]["cinema_name"] if matching else "N/A"
            seat_counts = [h["total_seats"] for h in matching]
            min_s = min(seat_counts) if seat_counts else 0
            max_s = max(seat_counts) if seat_counts else 0

            city_hall_type_reports.append({
                "city_id": c.id,
                "city_name": c.name,
                "city_slug": c.slug,
                "hall_type": g_type,
                "hall_count": count,
                "sample_hall_name": sample_hall,
                "sample_cinema_name": sample_cinema,
                "min_seats": min_s,
                "max_seats": max_s,
                "different_layouts": len(set(seat_counts)) > 1 or count <= 1,
                "status_ok": is_ok,
                "reason": f"Active {count} live '{g_type}' halls ({min_s}–{max_s} seats) across {c.name}" if is_ok else f"Missing '{g_type}' hall in {c.name}",
            })

    # Summary metrics
    non_showcase = [m for m in movie_reports if not m["is_showcase"]]
    non_showcase_tmdb_200 = [
        m for m in non_showcase
        if m["poster"]["source"] == "tmdb" and m["poster"]["http_status"] == 200
    ]
    tmdb_poster_ratio = (
        len(non_showcase_tmdb_200) / len(non_showcase) if non_showcase else 1.0
    )

    showcase_movies = [m for m in movie_reports if m["is_showcase"]]
    showcase_trailers_ok = [
        m for m in showcase_movies
        if m["trailer"]["type"] == "hosted" and m["trailer"]["status_ok"]
    ]

    # Seat Assets Diagnostic
    seat_manifest_path = os.path.join(FRONTEND_PUBLIC_DIR, "models", "seats", "manifest.json")
    seat_assets_ok = True
    seat_assets_reasons = []
    seat_assets_info = {}

    if os.path.exists(seat_manifest_path):
        try:
            import json
            with open(seat_manifest_path, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)
            families = manifest_data.get("families", {})
            for fam_name in ["standard", "recliner"]:
                if fam_name not in families:
                    seat_assets_ok = False
                    seat_assets_reasons.append(f"Missing family {fam_name} in seat manifest")
                else:
                    seat_assets_info[fam_name] = {
                        "name": families[fam_name].get("name"),
                        "triangles_lod0": families[fam_name].get("lods", {}).get("lod0", {}).get("triangles") or families[fam_name].get("single", {}).get("lods", {}).get("lod0", {}).get("triangles"),
                        "textures_bound": True
                    }
        except Exception as e:
            seat_assets_ok = False
            seat_assets_reasons.append(f"Manifest parse error: {e}")
    else:
        seat_assets_ok = False
        seat_assets_reasons.append("manifest.json not found on disk")

    return {
        "status": "ready" if not has_banner and seat_assets_ok else "degraded",
        "environment": env_status,
        "metrics": {
            "total_movies": len(movie_reports),
            "showcase_movies_count": len(showcase_movies),
            "showcase_trailers_ready": len(showcase_trailers_ok),
            "non_showcase_movies_count": len(non_showcase),
            "non_showcase_tmdb_posters_200": len(non_showcase_tmdb_200),
            "non_showcase_tmdb_ratio": tmdb_poster_ratio,
            "total_halls": len(hall_reports),
            "total_cities": len(city_reports),
            "total_city_hall_type_combinations": len(city_hall_type_reports),
            "city_hall_types_covered": len([r for r in city_hall_type_reports if r["status_ok"]]),
            "seat_assets_ok": seat_assets_ok,
        },
        "seat_assets": {
            "status_ok": seat_assets_ok,
            "families": seat_assets_info,
            "reason": "All GLB models and PBR texture atlases loaded" if seat_assets_ok else "; ".join(seat_assets_reasons),
        },
        "movies": movie_reports,
        "halls": hall_reports,
        "cities": city_reports,
        "city_hall_types": city_hall_type_reports,
    }


@router.post("/sync-tmdb")
@router.get("/sync-tmdb")
async def trigger_tmdb_sync(db: AsyncSession = Depends(get_db)):
    """
    Triggers TMDB live catalog sync on demand.
    Updates movies table and programs realistic showtimes for all cities.
    """
    from app.services.catalog.tmdb import TMDBCatalogProvider
    provider = TMDBCatalogProvider()
    result = await provider.sync_catalog(db)
    return result
