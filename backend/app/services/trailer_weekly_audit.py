import asyncio
import logging
import os
import json
import random
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.movie import Movie
from app.services.catalog.tmdb import check_youtube_video_details

logger = logging.getLogger("cineverse.catalog.weekly_audit")

WEEKLY_AUDIT_LOG: List[Dict[str, Any]] = []
WEEKLY_AUDIT_ALERTS: List[Dict[str, Any]] = []

def get_weekly_audit_alerts() -> List[Dict[str, Any]]:
    return list(WEEKLY_AUDIT_ALERTS)

def get_weekly_audit_history() -> List[Dict[str, Any]]:
    return list(WEEKLY_AUDIT_LOG)

def dispatch_weekly_audit_alert(audit_report: Dict[str, Any]):
    """
    Dispatches alert if failure rate exceeds 5%.
    """
    alert = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "WEEKLY_AUDIT_FAILURE_RATE_EXCEEDED",
        "sampled_count": audit_report.get("sampled_count"),
        "failed_count": audit_report.get("failed_count"),
        "failure_rate_pct": audit_report.get("failure_rate_pct"),
        "failed_titles": audit_report.get("failed_titles", []),
    }
    WEEKLY_AUDIT_ALERTS.append(alert)
    logger.critical(
        f"[WEEKLY_AUDIT_ALERT] HIGH ALERT: Trailer failure rate {audit_report.get('failure_rate_pct')}% "
        f"exceeds 5% threshold ({audit_report.get('failed_count')}/{audit_report.get('sampled_count')} failed)! "
        f"Failed movies: {[m['title'] for m in audit_report.get('failed_titles', [])]}"
    )

async def run_weekly_trailer_sample_audit(session: AsyncSession) -> Dict[str, Any]:
    """
    Audits a random sample of 30 titles for trailer availability and validity.
    Saves raw logs to evidence/weekly_audit and alerts if failure rate > 5%.
    """
    stmt = select(Movie).where(Movie.is_now_showing == True)
    res = await session.execute(stmt)
    active_movies = list(res.scalars().all())

    if not active_movies:
        stmt_all = select(Movie)
        res_all = await session.execute(stmt_all)
        active_movies = list(res_all.scalars().all())

    sample_size = min(30, len(active_movies))
    sampled_movies = random.sample(active_movies, sample_size) if len(active_movies) >= sample_size else active_movies

    audit_items = []
    failed_titles = []
    passed_count = 0

    for m in sampled_movies:
        stype = m.trailer_source_type or ("hosted" if m.is_showcase else "youtube")
        is_ok = False
        reason = "healthy"

        if stype == "hosted":
            # Check local file exists
            slug = m.slug
            trailer_path = os.path.join("frontend", "public", "trailers", f"{slug}.mp4")
            if os.path.exists(trailer_path) and os.path.getsize(trailer_path) > 1000:
                is_ok = True
            else:
                is_ok = False
                reason = f"Hosted file missing or empty: {trailer_path}"
        elif stype == "youtube":
            if m.youtube_trailer_id:
                try:
                    embeddable, is_short, w, h, _ = await asyncio.to_thread(check_youtube_video_details, m.youtube_trailer_id)
                    is_landscape = (not is_short) and (w >= h if (w > 0 and h > 0) else True)
                    if embeddable and is_landscape:
                        is_ok = True
                    else:
                        is_ok = False
                        reason = f"YouTube video not embeddable or portrait (embeddable={embeddable}, is_short={is_short}, {w}x{h})"
                except Exception as ex:
                    is_ok = False
                    reason = f"YouTube check error: {ex}"
            else:
                # If no trailer ID and embeddable is False, honest fallback counts as OK
                if m.trailer_embeddable is False:
                    is_ok = True
                    reason = "Honest title card fallback"
                else:
                    is_ok = False
                    reason = "Missing youtube_trailer_id without explicit fallback"
        else:
            is_ok = True
            reason = "No trailer (honest badge)"

        if is_ok:
            passed_count += 1
        else:
            failed_titles.append({"id": m.id, "title": m.title, "source_type": stype, "reason": reason})

        audit_items.append({
            "id": m.id,
            "title": m.title,
            "slug": m.slug,
            "source_type": stype,
            "is_ok": is_ok,
            "reason": reason,
        })

    failed_count = len(failed_titles)
    failure_rate_pct = round((failed_count / sample_size) * 100, 2) if sample_size > 0 else 0.0

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sampled_count": sample_size,
        "passed_count": passed_count,
        "failed_count": failed_count,
        "failure_rate_pct": failure_rate_pct,
        "threshold_pct": 5.0,
        "alert_triggered": failure_rate_pct > 5.0,
        "failed_titles": failed_titles,
        "audit_items": audit_items,
    }

    WEEKLY_AUDIT_LOG.append(report)

    # Save raw log file
    out_dir = os.path.abspath(os.path.join("evidence", "weekly_audit"))
    os.makedirs(out_dir, exist_ok=True)
    ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    log_file = os.path.join(out_dir, f"weekly_audit_{ts_str}.json")
    try:
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write weekly audit file: {e}")

    # Trigger alert if failure rate exceeds 5%
    if failure_rate_pct > 5.0:
        dispatch_weekly_audit_alert(report)

    return report

async def start_weekly_trailer_audit_scheduler(interval_seconds: int = 604800, run_on_startup: bool = True):
    """
    Background worker that runs the weekly sample audit every interval_seconds (default: 7 days / 604800s).
    """
    logger.info(f"[WEEKLY_AUDIT_SCHEDULER] Weekly trailer sample audit scheduler initiated (interval={interval_seconds}s / 7d)")
    if run_on_startup:
        await asyncio.sleep(6)
        try:
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                logger.info("[WEEKLY_AUDIT_SCHEDULER] Running scheduled weekly sample audit (30 titles) on startup...")
                rep = await run_weekly_trailer_sample_audit(session)
                logger.info(f"[WEEKLY_AUDIT_SCHEDULER] Weekly sample audit complete: sampled={rep['sampled_count']}, failed={rep['failed_count']} ({rep['failure_rate_pct']}%), alert={rep['alert_triggered']}")
        except Exception as e:
            logger.error(f"[WEEKLY_AUDIT_SCHEDULER] Error during initial weekly audit run: {e}")

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                logger.info("[WEEKLY_AUDIT_SCHEDULER] Running periodic weekly sample audit (30 titles)...")
                rep = await run_weekly_trailer_sample_audit(session)
                logger.info(f"[WEEKLY_AUDIT_SCHEDULER] Weekly sample audit complete: sampled={rep['sampled_count']}, failed={rep['failed_count']} ({rep['failure_rate_pct']}%), alert={rep['alert_triggered']}")
        except asyncio.CancelledError:
            logger.info("[WEEKLY_AUDIT_SCHEDULER] Weekly audit scheduler cancelled.")
            break
