import os
import httpx
from datetime import date, datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.movie import Movie
from app.services.trailer_pipeline import (
    transcode_and_package_trailer,
    generate_signed_trailer_url,
    verify_signed_trailer_token,
    PUBLIC_TRAILERS_DIR,
)
from app.services.trailer_freshness import (
    run_trailer_freshness_job,
    get_freshness_alerts,
    get_freshness_history,
)

router = APIRouter()


@router.post("/admin/trailers/attach")
async def attach_hosted_trailer(
    movie_id: int = Form(...),
    rights_holder: str = Form(...),
    license_note: str = Form(...),
    expiry_date: str = Form(...),
    trailer_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to attach a rights-cleared trailer to a movie (§ Part B.2).
    Validates required fields, runs virus scan, transcodes to 720p H.264/WebM,
    creates fast-start moov atom, poster frame, ambient clip, and saves metadata.
    """
    if not rights_holder.strip():
        raise HTTPException(status_code=400, detail="Rights holder is required.")
    if not license_note.strip():
        raise HTTPException(status_code=400, detail="License / permission note is required.")
    try:
        parsed_expiry = datetime.strptime(expiry_date.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Expiry date must be in YYYY-MM-DD format.")

    res = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = res.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found.")

    # Read raw bytes from uploaded file or download from provided URL
    raw_bytes: bytes = b""
    if file and file.filename:
        raw_bytes = await file.read()
    elif trailer_url and trailer_url.strip():
        # Check if local existing file
        clean_url = trailer_url.strip()
        if clean_url.startswith("/trailers/"):
            local_path = os.path.join(PUBLIC_TRAILERS_DIR, clean_url.replace("/trailers/", ""))
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    raw_bytes = f.read()
            else:
                raise HTTPException(status_code=400, detail="Local trailer file not found on disk.")
        elif clean_url.startswith("http://") or clean_url.startswith("https://"):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(clean_url)
                    if resp.status_code != 200:
                        raise HTTPException(status_code=400, detail=f"Failed to fetch video URL: HTTP {resp.status_code}")
                    raw_bytes = resp.content
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to download video from URL: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Invalid trailer URL provided.")
    else:
        raise HTTPException(status_code=400, detail="Either a file upload or a valid video URL is required.")

    try:
        pipeline_res = transcode_and_package_trailer(
            raw_bytes=raw_bytes,
            slug=movie.slug,
            title=movie.title,
            rights_holder=rights_holder.strip(),
            license_note=license_note.strip(),
            expiry_date=parsed_expiry,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Update movie in database
    movie.hosted_trailer_url = pipeline_res["hosted_trailer_url"]
    movie.hosted_trailer_webm_url = pipeline_res["hosted_trailer_webm_url"]
    movie.hosted_trailer_poster_url = pipeline_res["hosted_trailer_poster_url"]
    movie.hosted_trailer_ambient_clip_url = pipeline_res["hosted_trailer_ambient_clip_url"]
    movie.trailer_rights_holder = pipeline_res["trailer_rights_holder"]
    movie.trailer_license_note = pipeline_res["trailer_license_note"]
    movie.trailer_license_expiry = pipeline_res["trailer_license_expiry"]
    movie.trailer_source_type = "hosted"
    movie.trailer_file_size_bytes = pipeline_res["trailer_file_size_bytes"]
    movie.trailer_virus_scanned = True
    movie.trailer_url = pipeline_res["hosted_trailer_url"]
    movie.glimpse_url = pipeline_res["hosted_trailer_ambient_clip_url"]

    await db.commit()
    await db.refresh(movie)

    signed_url = generate_signed_trailer_url(movie.id)

    return {
        "success": True,
        "movie_id": movie.id,
        "title": movie.title,
        "hosted_trailer_url": movie.hosted_trailer_url,
        "hosted_trailer_webm_url": movie.hosted_trailer_webm_url,
        "poster_frame_url": movie.hosted_trailer_poster_url,
        "ambient_clip_url": movie.hosted_trailer_ambient_clip_url,
        "rights_holder": movie.trailer_rights_holder,
        "license_note": movie.trailer_license_note,
        "license_expiry": str(movie.trailer_license_expiry),
        "file_size_bytes": movie.trailer_file_size_bytes,
        "signed_url": signed_url,
        "message": "Trailer transcoded and attached successfully with clean virus scan.",
    }


@router.get("/admin/trailers/readiness")
async def get_trailers_readiness_table(db: AsyncSession = Depends(get_db)):
    """
    Readiness table showing per movie the source in use and the rights status (§ Part B.2).
    """
    res = await db.execute(select(Movie).order_by(Movie.id))
    movies = res.scalars().all()

    today = date.today()
    items = []

    for m in movies:
        is_hosted = bool(m.hosted_trailer_url or m.trailer_source_type == "hosted")
        has_youtube = bool(m.youtube_trailer_id or (m.trailer_url and "youtube" in m.trailer_url))

        if is_hosted:
            source_in_use = "Hosted 720p"
            is_expired = bool(m.trailer_license_expiry and m.trailer_license_expiry < today)
            rights_status = "Expired" if is_expired else "Active & Rights Cleared"
        elif has_youtube:
            source_in_use = "Official YouTube Player"
            is_expired = False
            rights_status = "Official Embed (API ToS Sanctioned)"
        else:
            source_in_use = "Title Card"
            is_expired = False
            rights_status = "No Trailer Available"

        size_formatted = None
        if m.trailer_file_size_bytes:
            size_mb = m.trailer_file_size_bytes / (1024 * 1024)
            size_formatted = f"{size_mb:.1f} MB"

        signed_url = generate_signed_trailer_url(m.id) if is_hosted else None

        items.append({
            "movie_id": m.id,
            "title": m.title,
            "slug": m.slug,
            "source_in_use": source_in_use,
            "trailer_url": m.hosted_trailer_url or m.trailer_url,
            "youtube_trailer_id": m.youtube_trailer_id,
            "rights_holder": m.trailer_rights_holder or ("Official YouTube Uploader" if has_youtube else None),
            "license_note": m.trailer_license_note or ("YouTube API Terms of Service" if has_youtube else None),
            "license_expiry": str(m.trailer_license_expiry) if m.trailer_license_expiry else ("Perpetual Embed" if has_youtube else None),
            "is_expired": is_expired,
            "rights_status": rights_status,
            "file_size_formatted": size_formatted,
            "poster_frame_url": m.hosted_trailer_poster_url or m.trailer_poster_frame_url,
            "ambient_clip_url": m.hosted_trailer_ambient_clip_url or m.glimpse_url,
            "signed_url": signed_url,
            "trailer_embeddable": bool(m.trailer_embeddable) if has_youtube else True,
        })

    return {
        "status": "success",
        "total_movies": len(items),
        "hosted_count": sum(1 for i in items if i["source_in_use"] == "Hosted 720p"),
        "youtube_count": sum(1 for i in items if i["source_in_use"] == "Official YouTube Player"),
        "title_card_count": sum(1 for i in items if i["source_in_use"] == "Title Card"),
        "trailers": items,
    }


@router.get("/trailers/stream/{movie_id}")
async def stream_hosted_trailer(
    movie_id: int,
    token: str = Query(...),
    expires: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Streams a hosted trailer with signed expiring URL verification (§ Part B.2).
    Returns HTTP 403 if token is invalid or expired. Supports HTTP 206 range requests.
    """
    if not verify_signed_trailer_token(movie_id, token, expires):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signed trailer access token has expired or is invalid.",
        )

    res = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = res.scalar_one_or_none()
    if not movie or not movie.hosted_trailer_url:
        raise HTTPException(status_code=404, detail="Hosted trailer not found for movie.")

    filename = os.path.basename(movie.hosted_trailer_url)
    filepath = os.path.join(PUBLIC_TRAILERS_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Trailer media file not found on server.")

    return FileResponse(filepath, media_type="video/mp4", filename=filename)


@router.post("/admin/trailers/freshness/run")
async def trigger_trailer_freshness_check(db: AsyncSession = Depends(get_db)):
    """
    Triggers the nightly trailer freshness and embeddability audit job (§ Task 4).
    Re-checks every trailer, replaces broken ones, and raises alerts.
    """
    report = await run_trailer_freshness_job(db)
    return report


@router.get("/admin/trailers/freshness/status")
async def get_trailer_freshness_status():
    """
    Returns latest freshness job history, active alerts, and health metrics.
    """
    history = get_freshness_history()
    alerts = get_freshness_alerts()
    return {
        "latest_run": history[0] if history else None,
        "total_runs": len(history),
        "active_alerts": alerts,
        "history": history[:10],
    }

