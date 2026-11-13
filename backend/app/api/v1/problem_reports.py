import os
import time
import uuid
import base64
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.config import settings
from app.database import get_db
from app.models.auth import User, RoleEnum
from app.models.problem_report import ProblemReport
from app.schemas.problem_report import (
    ProblemReportCreate,
    ProblemReportUpdate,
    ProblemReportResponse,
    generate_antigravity_prompt
)
from app.services.auth_service import require_role
from app.services.scrubber import scrub_data

router = APIRouter()

# Directory for saved screenshots
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_repo_dir = os.path.abspath(os.path.join(_backend_dir, ".."))
UPLOADS_DIR = os.path.join(_repo_dir, "frontend", "public", "bug_reports")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# In-memory sliding window rate limiter: { ip: [timestamp, ...] }
_rate_limits: Dict[str, List[float]] = {}
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 10
MAX_PAYLOAD_BYTES = 5 * 1024 * 1024  # 5MB


def check_rate_limit(client_ip: str):
    now = time.time()
    timestamps = _rate_limits.get(client_ip, [])
    # keep only within window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many problem reports submitted from this IP. Please wait a minute."
        )
    timestamps.append(now)
    _rate_limits[client_ip] = timestamps


@router.post("/reports", status_code=status.HTTP_201_CREATED)
async def submit_problem_report(
    payload: ProblemReportCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Public submission endpoint to report a bug/problem.
    Rate-limited, size-limited, and scrubs all sensitive tokens and personal data.
    """
    # 1. Feature Flag Check
    if not settings.ENABLE_BUG_REPORTING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bug reporting feature is currently disabled."
        )

    # 2. Rate Limiting Check
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(client_ip)

    # 3. Screenshot processing and size limits
    screenshot_filename = None
    if payload.screenshot_base64:
        # Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
        raw_b64 = payload.screenshot_base64
        ext = "jpg"
        if "data:image/" in raw_b64 and ";base64," in raw_b64:
            header, raw_b64 = raw_b64.split(";base64,", 1)
            if "png" in header:
                ext = "png"
            elif "webp" in header:
                ext = "webp"

        # Check payload size
        if len(raw_b64) > MAX_PAYLOAD_BYTES * 1.4:  # base64 expansion factor ~1.33
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Screenshot payload exceeds 5MB limit."
            )

        try:
            img_data = base64.b64decode(raw_b64)
            if len(img_data) > MAX_PAYLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Decoded screenshot exceeds 5MB limit."
                )

            filename = f"report_{uuid.uuid4().hex[:12]}.{ext}"
            filepath = os.path.join(UPLOADS_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(img_data)
            screenshot_filename = filename
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            # Ignore invalid base64 and proceed without image rather than crashing
            pass

    # 4. Scrub sensitive information
    scrubbed_desc = scrub_data(payload.user_description)
    scrubbed_expected = scrub_data(payload.expected_behavior) if payload.expected_behavior else None
    scrubbed_query = scrub_data(payload.query_params) if payload.query_params else {}
    scrubbed_logs = scrub_data(payload.console_logs) if payload.console_logs else []
    scrubbed_requests = scrub_data(payload.network_requests) if payload.network_requests else []
    scrubbed_browser = scrub_data(payload.browser_info) if payload.browser_info else {}
    scrubbed_render = scrub_data(payload.render_metrics) if payload.render_metrics else {}

    # Truncate lists to limits: 50 console messages, 20 network requests
    if len(scrubbed_logs) > 50:
        scrubbed_logs = scrubbed_logs[-50:]
    if len(scrubbed_requests) > 20:
        scrubbed_requests = scrubbed_requests[-20:]

    report = ProblemReport(
        status="open",
        user_description=scrubbed_desc,
        expected_behavior=scrubbed_expected,
        screenshot_filename=screenshot_filename,
        url=payload.url,
        route=payload.route,
        query_params=scrubbed_query,
        build_stamp=payload.build_stamp,
        auditorium_id=payload.auditorium_id,
        showtime_id=payload.showtime_id,
        cinema_id=payload.cinema_id,
        mode=payload.mode,
        selected_seats=payload.selected_seats or [],
        console_logs=scrubbed_logs,
        network_requests=scrubbed_requests,
        browser_info=scrubbed_browser,
        render_metrics=scrubbed_render,
        reporter_ip=client_ip[:15] if client_ip else None,
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return {
        "id": report.id,
        "status": "submitted",
        "message": "Problem report received successfully. Thank you for reporting!",
        "screenshot_url": f"/bug_reports/{screenshot_filename}" if screenshot_filename else None
    }


@router.get("/reports/screenshot/{filename}")
async def get_report_screenshot(filename: str):
    """Serve a captured bug screenshot safely."""
    # Prevent path traversal
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(UPLOADS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Screenshot not found")
    media_type = "image/png" if safe_filename.endswith(".png") else "image/jpeg"
    return FileResponse(filepath, media_type=media_type)


@router.get("/admin/reports", response_model=List[ProblemReportResponse])
async def list_problem_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    route_filter: Optional[str] = Query(None, alias="route"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    List problem reports with filtering. Admin only.
    """
    stmt = select(ProblemReport).order_by(desc(ProblemReport.created_at))

    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(ProblemReport.status == status_filter.lower())
    if route_filter:
        stmt = stmt.where(ProblemReport.route.ilike(f"%{route_filter}%"))
    if search:
        stmt = stmt.where(
            ProblemReport.user_description.ilike(f"%{search}%") |
            ProblemReport.route.ilike(f"%{search}%")
        )

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    reports = res.scalars().all()

    output = []
    for r in reports:
        prompt = generate_antigravity_prompt(r)
        screen_url = f"/bug_reports/{r.screenshot_filename}" if r.screenshot_filename else None
        item = ProblemReportResponse(
            id=r.id,
            created_at=r.created_at,
            updated_at=r.updated_at,
            status=r.status,
            user_description=r.user_description,
            expected_behavior=r.expected_behavior,
            screenshot_url=screen_url,
            url=r.url,
            route=r.route,
            query_params=r.query_params or {},
            build_stamp=r.build_stamp,
            auditorium_id=r.auditorium_id,
            showtime_id=r.showtime_id,
            cinema_id=r.cinema_id,
            mode=r.mode,
            selected_seats=r.selected_seats or [],
            console_logs=r.console_logs or [],
            network_requests=r.network_requests or [],
            browser_info=r.browser_info or {},
            render_metrics=r.render_metrics or {},
            reporter_ip=r.reporter_ip,
            admin_notes=r.admin_notes,
            antigravity_prompt=prompt,
        )
        output.append(item)

    return output


@router.get("/admin/reports/export")
async def export_open_reports(
    status_filter: str = Query("open", alias="status"),
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Export all open reports formatted for batch ingestion or prompt generation.
    Admin only.
    """
    stmt = select(ProblemReport).order_by(desc(ProblemReport.created_at))
    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(ProblemReport.status == status_filter.lower())

    res = await db.execute(stmt)
    reports = res.scalars().all()

    export_items = []
    for r in reports:
        prompt = generate_antigravity_prompt(r)
        export_items.append({
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "status": r.status,
            "user_description": r.user_description,
            "expected_behavior": r.expected_behavior,
            "route": r.route,
            "url": r.url,
            "mode": r.mode,
            "auditorium_id": r.auditorium_id,
            "showtime_id": r.showtime_id,
            "build_stamp": r.build_stamp,
            "selected_seats": r.selected_seats,
            "screenshot_url": f"/bug_reports/{r.screenshot_filename}" if r.screenshot_filename else None,
            "antigravity_prompt": prompt,
        })

    return {
        "count": len(export_items),
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "filter": status_filter,
        "reports": export_items
    }


@router.get("/admin/reports/{report_id}", response_model=ProblemReportResponse)
async def get_problem_report(
    report_id: int,
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full details for a single problem report. Admin only."""
    stmt = select(ProblemReport).where(ProblemReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Problem report not found")

    prompt = generate_antigravity_prompt(report)
    screen_url = f"/bug_reports/{report.screenshot_filename}" if report.screenshot_filename else None
    return ProblemReportResponse(
        id=report.id,
        created_at=report.created_at,
        updated_at=report.updated_at,
        status=report.status,
        user_description=report.user_description,
        expected_behavior=report.expected_behavior,
        screenshot_url=screen_url,
        url=report.url,
        route=report.route,
        query_params=report.query_params or {},
        build_stamp=report.build_stamp,
        auditorium_id=report.auditorium_id,
        showtime_id=report.showtime_id,
        cinema_id=report.cinema_id,
        mode=report.mode,
        selected_seats=report.selected_seats or [],
        console_logs=report.console_logs or [],
        network_requests=report.network_requests or [],
        browser_info=report.browser_info or {},
        render_metrics=report.render_metrics or {},
        reporter_ip=report.reporter_ip,
        admin_notes=report.admin_notes,
        antigravity_prompt=prompt,
    )


@router.patch("/admin/reports/{report_id}", response_model=ProblemReportResponse)
async def update_problem_report(
    report_id: int,
    payload: ProblemReportUpdate,
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Update status or admin notes on a report. Admin only."""
    stmt = select(ProblemReport).where(ProblemReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Problem report not found")

    if payload.status:
        report.status = payload.status.lower()
    if payload.admin_notes is not None:
        report.admin_notes = payload.admin_notes

    await db.commit()
    await db.refresh(report)

    prompt = generate_antigravity_prompt(report)
    screen_url = f"/bug_reports/{report.screenshot_filename}" if report.screenshot_filename else None
    return ProblemReportResponse(
        id=report.id,
        created_at=report.created_at,
        updated_at=report.updated_at,
        status=report.status,
        user_description=report.user_description,
        expected_behavior=report.expected_behavior,
        screenshot_url=screen_url,
        url=report.url,
        route=report.route,
        query_params=report.query_params or {},
        build_stamp=report.build_stamp,
        auditorium_id=report.auditorium_id,
        showtime_id=report.showtime_id,
        cinema_id=report.cinema_id,
        mode=report.mode,
        selected_seats=report.selected_seats or [],
        console_logs=report.console_logs or [],
        network_requests=report.network_requests or [],
        browser_info=report.browser_info or {},
        render_metrics=report.render_metrics or {},
        reporter_ip=report.reporter_ip,
        admin_notes=report.admin_notes,
        antigravity_prompt=prompt,
    )

