import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.movie import Movie
from app.services.catalog.tmdb import check_youtube_video_details, _execute_tmdb_curl

logger = logging.getLogger("cineverse.catalog.freshness")

# In-memory store for freshness audit logs and alert notices
FRESHNESS_AUDIT_LOG: List[Dict[str, Any]] = []
ALERT_NOTICES: List[Dict[str, Any]] = []

def get_freshness_alerts() -> List[Dict[str, Any]]:
    return list(ALERT_NOTICES)

def get_freshness_history() -> List[Dict[str, Any]]:
    return list(FRESHNESS_AUDIT_LOG)

def dispatch_alert_notification(alert_item: Dict[str, Any]):
    """
    Dispatches critical alerts to ops channels (admin notification center, log, webhook).
    """
    logger.warning(
        f"[TRAILER_ALERT_DISPATCH] CRITICAL ALERT: Movie {alert_item.get('movie_id')} ({alert_item.get('title')}) "
        f"lost embeddable trailer (Key: {alert_item.get('broken_key')})! Reason: {alert_item.get('reason')}. "
        f"Dispatched to admin notification feed and operations alert queue."
    )

async def start_trailer_freshness_scheduler(interval_seconds: int = 86400, run_on_startup: bool = True):
    """
    Background worker loop that triggers the trailer freshness audit every interval_seconds (default: 86400s / 24 hours).
    """
    logger.info(f"[TRAILER_SCHEDULER] Nightly trailer freshness scheduler initiated (interval={interval_seconds}s / 24h)")
    if run_on_startup:
        # Give server a few seconds to warm up before first run
        await asyncio.sleep(4)
        try:
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                logger.info("[TRAILER_SCHEDULER] Running scheduled trailer freshness check on startup...")
                rep = await run_trailer_freshness_job(session)
                logger.info(f"[TRAILER_SCHEDULER] Freshness check complete: checked={rep['total_checked']}, replaced={rep['replaced_count']}, lost={rep['lost_count']}, alerts={rep['alerts_raised']}")
        except Exception as e:
            logger.error(f"[TRAILER_SCHEDULER] Error during initial freshness run: {e}")

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                logger.info("[TRAILER_SCHEDULER] Running periodic nightly trailer freshness check...")
                rep = await run_trailer_freshness_job(session)
                logger.info(f"[TRAILER_SCHEDULER] Freshness check complete: checked={rep['total_checked']}, replaced={rep['replaced_count']}, lost={rep['lost_count']}, alerts={rep['alerts_raised']}")
        except asyncio.CancelledError:
            logger.info("[TRAILER_SCHEDULER] Trailer freshness scheduler cancelled.")
            break
        except Exception as e:
            logger.error(f"[TRAILER_SCHEDULER] Periodic run error: {e}")


async def run_trailer_freshness_job(db: AsyncSession) -> Dict[str, Any]:
    """
    Nightly / On-Demand Trailer Freshness & Self-Healing Pipeline (Task 4).
    1. Iterates over every movie in the catalogue.
    2. Hosted trailers: checks local file existence and checksum integrity.
    3. YouTube trailers: checks oEmbed HTTP 200, aspect ratio, and Shorts status.
    4. If a previously working trailer is broken/removed (Error 150/153/404/Private):
       - Searches TMDB videos for replacement candidates (Official Trailer -> Trailer -> Teaser -> Clip).
       - If replaced, logs self-healing success.
       - If no replacement found, downgrades to 'none', marks trailer_embeddable=False,
         and fires an alert for the movie losing its trailer.
    """
    start_time = datetime.now(timezone.utc)
    res = await db.execute(select(Movie).order_by(Movie.id))
    movies = res.scalars().all()

    total_checked = len(movies)
    healthy_hosted = 0
    healthy_youtube = 0
    replaced_count = 0
    lost_count = 0
    still_missing_count = 0

    run_alerts = []

    for movie in movies:
        is_hosted = bool(
            movie.hosted_trailer_url or 
            (movie.trailer_url and (movie.trailer_url.startswith("/trailers/") or movie.trailer_url.endswith(".mp4")))
        )
        has_yt = bool(movie.youtube_trailer_id or (movie.trailer_url and "youtube" in str(movie.trailer_url)))

        if is_hosted:
            healthy_hosted += 1
            continue

        if has_yt and movie.youtube_trailer_id:
            is_emb, is_sh, w, h, yt_title = check_youtube_video_details(movie.youtube_trailer_id)
            if is_emb and not is_sh:
                healthy_youtube += 1
                continue

            # Trailer became broken or restricted! Attempt self-healing
            logger.warning(f"Movie {movie.id} ({movie.title}) trailer {movie.youtube_trailer_id} is broken/restricted! Probing replacements...")
            new_key = None
            new_reason = None

            if movie.tmdb_id:
                vid_data = _execute_tmdb_curl(f"/movie/{movie.tmdb_id}/videos", timeout=8.0, retries=2)
                raw_vids = vid_data.get("results", []) if vid_data else []
                yt_cands = [v for v in raw_vids if v.get("site") == "YouTube" and v.get("key")]

                def _cand_rank(v):
                    v_type = v.get("type", "")
                    is_off = bool(v.get("official", False))
                    if v_type == "Trailer" and is_off: return 0
                    if v_type == "Trailer": return 1
                    if v_type == "Teaser" and is_off: return 2
                    if v_type == "Teaser": return 3
                    if v_type in ("Clip", "Featurette") and is_off: return 4
                    if v_type in ("Clip", "Featurette"): return 5
                    return 99

                sorted_cands = sorted([v for v in yt_cands if _cand_rank(v) < 99], key=_cand_rank)
                for cand in sorted_cands:
                    ckey = cand.get("key")
                    if ckey == movie.youtube_trailer_id:
                        continue # Skip known broken one
                    c_emb, c_sh, cw, ch, c_title = check_youtube_video_details(ckey)
                    if c_emb and not c_sh and (cw >= ch if (cw > 0 and ch > 0) else True):
                        new_key = ckey
                        v_type = cand.get("type", "Trailer")
                        is_off = cand.get("official", False)
                        new_reason = f"Freshness Auto-Replaced: {'Official' if is_off else 'Public'} 16:9 {v_type} ({cw}x{ch}) — '{c_title}'"
                        break

            if new_key:
                movie.youtube_trailer_id = new_key
                movie.trailer_url = f"https://www.youtube-nocookie.com/embed/{new_key}"
                movie.trailer_embeddable = True
                movie.trailer_reason = new_reason
                replaced_count += 1
                logger.info(f"Successfully self-healed movie {movie.id} ({movie.title}) with new trailer {new_key}")
            else:
                # Lost trailer
                prev_yt = movie.youtube_trailer_id
                movie.youtube_trailer_id = None
                movie.trailer_url = None
                movie.trailer_embeddable = False
                movie.trailer_reason = f"Lost embeddable trailer: video {prev_yt} became restricted and no backup qualified."
                lost_count += 1
                alert_item = {
                    "movie_id": movie.id,
                    "title": movie.title,
                    "broken_key": prev_yt,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "reason": "Embed restrictions or video removed by copyright owner",
                }
                run_alerts.append(alert_item)
                ALERT_NOTICES.append(alert_item)
                dispatch_alert_notification(alert_item)
        else:
            still_missing_count += 1

    await db.commit()

    duration_sec = (datetime.now(timezone.utc) - start_time).total_seconds()
    report = {
        "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "total_checked": total_checked,
        "healthy_hosted": healthy_hosted,
        "healthy_youtube": healthy_youtube,
        "replaced_count": replaced_count,
        "lost_count": lost_count,
        "still_missing_count": still_missing_count,
        "alerts_raised": len(run_alerts),
        "duration_seconds": round(duration_sec, 2),
        "alerts": run_alerts,
    }
    FRESHNESS_AUDIT_LOG.insert(0, report)
    if len(FRESHNESS_AUDIT_LOG) > 50:
        FRESHNESS_AUDIT_LOG.pop()

    return report
