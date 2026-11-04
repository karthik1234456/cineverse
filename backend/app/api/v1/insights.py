from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.auth import User, RoleEnum
from app.services.auth_service import require_role
from app.services.insights_service import (
    get_occupancy_forecast as svc_forecast,
    get_demand_alerts as svc_alerts,
    get_revenue_impact_preview as svc_revenue_preview
)

router = APIRouter(prefix="/insights", tags=["Admin Insights & Forecasting"])


@router.get("/occupancy-forecast")
async def get_showtime_occupancy_forecast(
    showtime_id: int = Query(..., description="Target showtime ID"),
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Explainable historical occupancy forecast with 95% confidence range."""
    return await svc_forecast(db, showtime_id)


@router.get("/demand-alerts")
async def get_demand_alerts(
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Real-time demand surges, capacity warnings, and waitlist backlog alerts."""
    return await svc_alerts(db)


class RevenuePreviewRequest(BaseModel):
    rule_id: int


@router.post("/revenue-impact-preview")
async def preview_revenue_impact(
    body: RevenuePreviewRequest,
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Estimates inventory value delta across upcoming showtimes for a proposed rule."""
    return await svc_revenue_preview(db, body.rule_id)
