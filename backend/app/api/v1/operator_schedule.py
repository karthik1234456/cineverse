# backend/app/api/v1/operator_schedule.py
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.auth import User, RoleEnum
from app.models.cinema import Cinema, Auditorium
from app.models.movie import Movie
from app.models.showtime import Showtime, PriceRule
from app.models.dynamic_pricing import DynamicPricingRule, PriceAuditLog
from app.models.import_batch import ImportBatch
from app.services.auth_service import require_role
from app.services.operator_schedule_service import OperatorScheduleService

router = APIRouter(prefix="/admin/schedule", tags=["Admin Operator Schedule"])


# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------

class SlotCreateRequest(BaseModel):
    cinema_id: int
    auditorium_id: int
    movie_id: int
    start_time: datetime
    format_type: str = "2D"
    language: str = "English"
    cleaning_gap_minutes: int = 20
    price_tier_rules: Optional[Dict[str, float]] = None


class BulkCopyRequest(BaseModel):
    cinema_id: int
    source_date: str = Field(..., description="Source date in YYYY-MM-DD format")
    target_dates: List[str] = Field(..., description="List of target dates in YYYY-MM-DD format")
    copy_mode: str = Field("SKIP_CONFLICTS", description="'SKIP_CONFLICTS' or 'FAIL_ON_CONFLICT'")


class ShowCancelExecuteRequest(BaseModel):
    mfa_code: str = Field(..., description="MFA code (e.g. MFA-123456)")
    reason: str = Field("Cinema operational cancellation", description="Reason for cancellation")
    idempotency_key: Optional[str] = None


class CSVImportPreviewRequest(BaseModel):
    csv_text: str
    entity_type: str = "SHOWTIMES"  # SHOWTIMES, HALLS, CINEMAS


class CSVImportExecuteRequest(BaseModel):
    csv_text: str
    entity_type: str = "SHOWTIMES"
    filename: str = "import.csv"


class PricingRuleUpsertRequest(BaseModel):
    name: str
    floor_price: float
    ceiling_price: float
    price_multiplier: float = 1.0
    flat_adjustment: float = 0.0
    category: Optional[str] = None
    cinema_id: Optional[int] = None
    format_type: Optional[str] = None
    min_occupancy_pct: float = 0.0
    max_occupancy_pct: float = 100.0
    rule_id: Optional[int] = None
    reason: str = "Operator pricing update"


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

@router.get("/cinemas")
async def get_accessible_cinemas(
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns cinemas accessible by current user.
    Admins see all cinemas; Cinema Managers see ONLY their assigned cinema.
    """
    role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).lower()
    stmt = select(Cinema).order_by(Cinema.name)
    
    if role_str in ["cinema_manager", "manager"]:
        if current_user.cinema_id is None:
            return []
        stmt = stmt.where(Cinema.id == current_user.cinema_id)
        
    res = await db.execute(stmt)
    cinemas = res.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "city_id": c.city_id,
            "address": c.address,
            "total_screens": c.total_screens or 0
        }
        for c in cinemas
    ]


@router.get("/timeline")
async def get_schedule_timeline(
    cinema_id: int = Query(...),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the full timeline of auditoriums and scheduled showtimes for a specific date,
    along with available movies to facilitate drag-and-drop or slot creation.
    """
    OperatorScheduleService.validate_manager_scope(current_user, cinema_id)

    # Cinema info
    cin_res = await db.execute(select(Cinema).where(Cinema.id == cinema_id))
    cinema = cin_res.scalars().first()
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found.")

    # Halls
    halls_res = await db.execute(
        select(Auditorium).where(Auditorium.cinema_id == cinema_id).order_by(Auditorium.id)
    )
    halls = halls_res.scalars().all()

    # Shows for date
    day_dt = datetime.strptime(date, "%Y-%m-%d").date()
    day_start = datetime.combine(day_dt, datetime.min.time())
    day_end = datetime.combine(day_dt, datetime.max.time())

    st_res = await db.execute(
        select(Showtime)
        .options(
            selectinload(Showtime.movie),
            selectinload(Showtime.auditorium),
            selectinload(Showtime.price_rules)
        )
        .where(
            Showtime.cinema_id == cinema_id,
            Showtime.start_time >= day_start,
            Showtime.start_time <= day_end
        )
        .order_by(Showtime.start_time)
    )
    showtimes = st_res.scalars().all()

    # Active movies for scheduling
    mov_res = await db.execute(select(Movie).order_by(Movie.title))
    movies = mov_res.scalars().all()

    return {
        "cinema": {
            "id": cinema.id,
            "name": cinema.name
        },
        "date": date,
        "auditoriums": [
            {
                "id": a.id,
                "name": a.name,
                "screen_type": a.screen_type,
                "total_seats": a.total_seats
            }
            for a in halls
        ],
        "showtimes": [
            {
                "id": s.id,
                "movie_id": s.movie_id,
                "movie_title": s.movie.title if s.movie else "Unknown",
                "movie_duration": s.movie.duration_minutes if s.movie else 120,
                "movie_poster": s.movie.poster_image_url if s.movie else "",
                "auditorium_id": s.auditorium_id,
                "auditorium_name": s.auditorium.name if s.auditorium else "",
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "cleaning_gap_minutes": s.cleaning_gap_minutes or 20,
                "effective_end_time": (s.end_time + timedelta(minutes=s.cleaning_gap_minutes or 20)).isoformat(),
                "format": s.format,
                "language": s.language,
                "status": s.status or "SCHEDULED",
                "cancellation_reason": s.cancellation_reason,
                "price_rules": {pr.category: pr.base_price for pr in s.price_rules}
            }
            for s in showtimes
        ],
        "movies": [
            {
                "id": m.id,
                "title": m.title,
                "duration_minutes": m.duration_minutes or 120,
                "poster_url": m.poster_image_url or "",
                "certification": m.certification or "UA",
                "language": m.language or "English"
            }
            for m in movies
        ]
    }


@router.get("/conflict-check")
async def check_schedule_conflict(
    auditorium_id: int = Query(...),
    start_time: datetime = Query(...),
    duration_minutes: int = Query(...),
    cleaning_gap_minutes: int = Query(20),
    exclude_showtime_id: Optional[int] = Query(None),
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Validates whether a proposed slot overlaps with existing showtimes or cleaning gap buffers.
    """
    end_time = start_time + timedelta(minutes=duration_minutes)
    conflict = await OperatorScheduleService.detect_conflicts(
        db=db,
        auditorium_id=auditorium_id,
        start_time=start_time,
        end_time=end_time,
        cleaning_gap_minutes=cleaning_gap_minutes,
        exclude_showtime_id=exclude_showtime_id
    )
    if conflict:
        return conflict
    return {"has_conflict": False, "message": "Slot is clear and adheres to cleaning buffer requirements."}


@router.post("/slots")
async def create_showtime_slot(
    payload: SlotCreateRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new showtime slot with automatic cleaning gap, conflict detection,
    and seat inventory initialization.
    """
    showtime = await OperatorScheduleService.create_showtime_slot(
        db=db,
        user=current_user,
        cinema_id=payload.cinema_id,
        auditorium_id=payload.auditorium_id,
        movie_id=payload.movie_id,
        start_time=payload.start_time,
        format_type=payload.format_type,
        language=payload.language,
        cleaning_gap_minutes=payload.cleaning_gap_minutes,
        price_tier_rules=payload.price_tier_rules
    )
    return {
        "success": True,
        "showtime_id": showtime.id,
        "movie_title": showtime.movie.title if showtime.movie else "",
        "start_time": showtime.start_time.isoformat(),
        "end_time": showtime.end_time.isoformat(),
        "status": showtime.status
    }


@router.post("/bulk-copy")
async def bulk_copy_schedule(
    payload: BulkCopyRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk copies schedule from a source date to one or more target dates.
    """
    return await OperatorScheduleService.bulk_copy_schedule(
        db=db,
        user=current_user,
        cinema_id=payload.cinema_id,
        source_date=payload.source_date,
        target_dates=payload.target_dates,
        copy_mode=payload.copy_mode
    )


@router.get("/showtimes/{showtime_id}/price-map-preview")
async def get_price_map_preview(
    showtime_id: int,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns seat price map preview identical to the customer booking view.
    """
    return await OperatorScheduleService.get_seat_price_map_preview(
        db=db,
        showtime_id=showtime_id,
        user=current_user
    )


@router.post("/showtimes/{showtime_id}/cancel-dry-run")
async def cancel_show_dry_run(
    showtime_id: int,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Dry run showtime cancellation: lists affected bookings, tickets, and refund amounts
    without mutating database state.
    """
    return await OperatorScheduleService.dry_run_cancel_show(
        db=db,
        showtime_id=showtime_id,
        user=current_user
    )


@router.post("/showtimes/{showtime_id}/cancel")
async def cancel_show_execute(
    showtime_id: int,
    payload: ShowCancelExecuteRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes showtime cancellation with MFA, releasing seats, issuing 100% full refunds,
    and recording user notifications. Safe against duplicate calls (idempotent).
    """
    return await OperatorScheduleService.execute_cancel_show(
        db=db,
        showtime_id=showtime_id,
        user=current_user,
        mfa_code=payload.mfa_code,
        reason=payload.reason,
        idempotency_key=payload.idempotency_key
    )


@router.post("/import/preview")
async def preview_csv_import(
    payload: CSVImportPreviewRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Performs per-row validation on uploaded cinema/hall/showtime CSV data and returns
    an error report and sample valid rows.
    """
    return await OperatorScheduleService.parse_and_validate_csv(
        db=db,
        csv_text=payload.csv_text,
        entity_type=payload.entity_type,
        user=current_user
    )


@router.post("/import/execute")
async def execute_csv_import(
    payload: CSVImportExecuteRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Imports validated CSV records, assigning an import_batch_id for undo capability.
    """
    return await OperatorScheduleService.execute_csv_import(
        db=db,
        csv_text=payload.csv_text,
        entity_type=payload.entity_type,
        user=current_user,
        filename=payload.filename
    )


@router.post("/import/{batch_id}/undo")
async def undo_csv_import(
    batch_id: str,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Rolls back an import batch cleanly if no bookings have been made on the imported showtimes.
    """
    return await OperatorScheduleService.undo_import_batch(
        db=db,
        batch_id=batch_id,
        user=current_user
    )


@router.get("/import/batches")
async def list_import_batches(
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists recent CSV import batches.
    """
    stmt = select(ImportBatch).order_by(desc(ImportBatch.created_at)).limit(20)
    res = await db.execute(stmt)
    batches = res.scalars().all()
    return [
        {
            "batch_id": b.batch_id,
            "entity_type": b.entity_type,
            "filename": b.filename,
            "total_rows": b.total_rows,
            "valid_rows": b.valid_rows,
            "invalid_rows": b.invalid_rows,
            "status": b.status,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "undone_at": b.undone_at.isoformat() if b.undone_at else None
        }
        for b in batches
    ]


@router.get("/pricing-rules")
async def list_pricing_rules(
    cinema_id: Optional[int] = Query(None),
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists dynamic pricing rules and recent audit log entries.
    """
    role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).lower()
    if role_str in ["cinema_manager", "manager"]:
        cinema_id = current_user.cinema_id

    stmt = select(DynamicPricingRule).order_by(desc(DynamicPricingRule.updated_at))
    if cinema_id is not None:
        stmt = stmt.where(or_(DynamicPricingRule.cinema_id == None, DynamicPricingRule.cinema_id == cinema_id))

    rules_res = await db.execute(stmt)
    rules = rules_res.scalars().all()

    audit_res = await db.execute(select(PriceAuditLog).order_by(desc(PriceAuditLog.timestamp)).limit(30))
    audit_logs = audit_res.scalars().all()

    return {
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "cinema_id": r.cinema_id,
                "format": r.format,
                "floor_price": r.floor_price,
                "ceiling_price": r.ceiling_price,
                "price_multiplier": r.price_multiplier,
                "flat_adjustment": r.flat_adjustment,
                "min_occupancy_pct": r.min_occupancy_pct,
                "max_occupancy_pct": r.max_occupancy_pct,
                "version": r.version or 1,
                "status": str(r.status.value if hasattr(r.status, 'value') else r.status),
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            }
            for r in rules
        ],
        "audit_logs": [
            {
                "id": a.id,
                "rule_id": a.rule_id,
                "action": a.action,
                "admin_id": a.admin_id,
                "details": a.details,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None
            }
            for a in audit_logs
        ]
    }


@router.post("/pricing-rules")
async def upsert_pricing_rule(
    payload: PricingRuleUpsertRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates or updates a versioned pricing rule with floor/ceiling enforcement and audit trail.
    """
    rule = await OperatorScheduleService.save_pricing_rule_version(
        db=db,
        user=current_user,
        name=payload.name,
        floor_price=payload.floor_price,
        ceiling_price=payload.ceiling_price,
        price_multiplier=payload.price_multiplier,
        flat_adjustment=payload.flat_adjustment,
        category=payload.category,
        cinema_id=payload.cinema_id,
        format_type=payload.format_type,
        min_occupancy_pct=payload.min_occupancy_pct,
        max_occupancy_pct=payload.max_occupancy_pct,
        rule_id=payload.rule_id,
        reason=payload.reason
    )
    return {
        "success": True,
        "rule_id": rule.id,
        "name": rule.name,
        "version": rule.version,
        "floor_price": rule.floor_price,
        "ceiling_price": rule.ceiling_price
    }
