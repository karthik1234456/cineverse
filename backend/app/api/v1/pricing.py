from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.auth import User, RoleEnum
from app.models.dynamic_pricing import DynamicPricingRule, PricingRuleStatusEnum, PriceAuditLog
from app.services.auth_service import require_role
from app.services.dynamic_pricing_service import (
    calculate_rule_price,
    simulate_pricing_rule,
    apply_pricing_rules_to_showtime,
)

router = APIRouter(prefix="/pricing", tags=["Admin Dynamic Pricing"])


class CreatePricingRuleRequest(BaseModel):
    name: str
    cinema_id: Optional[int] = None
    format: Optional[str] = None
    min_occupancy_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    max_occupancy_pct: float = Field(default=100.0, ge=0.0, le=100.0)
    hours_before_show_min: Optional[float] = None
    hours_before_show_max: Optional[float] = None
    day_type: str = Field(default="all")  # "weekday", "weekend", "all"
    price_multiplier: float = Field(default=1.0, ge=0.5, le=3.0)
    flat_adjustment: float = Field(default=0.0)
    floor_price: float = Field(ge=50.0)
    ceiling_price: float = Field(ge=100.0)


class SimulatePricingRequest(BaseModel):
    name: Optional[str] = "Preview Simulation"
    floor_price: float
    ceiling_price: float
    price_multiplier: float
    flat_adjustment: float = 0.0
    min_occupancy_pct: float = 0.0
    max_occupancy_pct: float = 100.0
    day_type: str = "all"
    format: Optional[str] = None


@router.post("/rules")
async def create_pricing_rule(
    body: CreatePricingRuleRequest,
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Creates a transparent pricing rule in DRAFT status."""
    if body.floor_price >= body.ceiling_price:
        raise HTTPException(status_code=400, detail="floor_price must be strictly less than ceiling_price")

    rule = DynamicPricingRule(
        name=body.name,
        cinema_id=body.cinema_id,
        format=body.format,
        min_occupancy_pct=body.min_occupancy_pct,
        max_occupancy_pct=body.max_occupancy_pct,
        hours_before_show_min=body.hours_before_show_min,
        hours_before_show_max=body.hours_before_show_max,
        day_type=body.day_type,
        price_multiplier=body.price_multiplier,
        flat_adjustment=body.flat_adjustment,
        floor_price=body.floor_price,
        ceiling_price=body.ceiling_price,
        status=PricingRuleStatusEnum.DRAFT,
        created_by_admin_id=current_admin.id
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    # Audit log
    audit = PriceAuditLog(
        rule_id=rule.id,
        action="RULE_CREATED",
        admin_id=current_admin.id,
        details={"name": rule.name, "status": rule.status.value}
    )
    db.add(audit)
    await db.commit()

    return {
        "rule_id": rule.id,
        "name": rule.name,
        "status": rule.status.value,
        "floor_price": rule.floor_price,
        "ceiling_price": rule.ceiling_price,
        "message": "Pricing rule created in DRAFT status. Requires approval before activation."
    }


@router.post("/rules/{rule_id}/approve")
async def approve_pricing_rule(
    rule_id: int,
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Approval gate: activates a draft pricing rule with audit logging."""
    rule = await db.get(DynamicPricingRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule not found")

    rule.status = PricingRuleStatusEnum.ACTIVE
    rule.approved_by_admin_id = current_admin.id
    rule.approved_at = datetime.utcnow()

    audit = PriceAuditLog(
        rule_id=rule.id,
        action="RULE_APPROVED",
        admin_id=current_admin.id,
        details={"approved_by": current_admin.email, "activated_at": rule.approved_at.isoformat()}
    )
    db.add(audit)
    await db.commit()

    return {
        "rule_id": rule.id,
        "name": rule.name,
        "status": rule.status.value,
        "approved_by_admin_id": rule.approved_by_admin_id,
        "message": f"Pricing rule '{rule.name}' successfully approved and activated."
    }


@router.get("/rules")
async def list_pricing_rules(
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Lists all dynamic pricing rules."""
    res = await db.execute(select(DynamicPricingRule).order_by(DynamicPricingRule.created_at.desc()))
    rules = res.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "status": r.status.value,
            "format": r.format,
            "min_occupancy_pct": r.min_occupancy_pct,
            "max_occupancy_pct": r.max_occupancy_pct,
            "day_type": r.day_type,
            "price_multiplier": r.price_multiplier,
            "flat_adjustment": r.flat_adjustment,
            "floor_price": r.floor_price,
            "ceiling_price": r.ceiling_price,
            "created_at": r.created_at.isoformat(),
            "approved_at": r.approved_at.isoformat() if r.approved_at else None
        }
        for r in rules
    ]


@router.post("/simulate")
async def preview_rule_simulation(
    body: SimulatePricingRequest,
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Pre-activation simulation preview ensuring floor/ceiling bounds."""
    return await simulate_pricing_rule(db, body.model_dump())


@router.post("/apply/{showtime_id}")
async def apply_pricing_to_showtime(
    showtime_id: int,
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Updates pricing on unheld, unbooked inventory. Invariant: held/booked seats are untouched."""
    return await apply_pricing_rules_to_showtime(db, showtime_id, current_admin)


@router.get("/audit-logs")
async def get_price_audit_logs(
    current_admin: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """Returns append-only audit trail of pricing rule changes and executions."""
    res = await db.execute(select(PriceAuditLog).order_by(PriceAuditLog.created_at.desc()).limit(100))
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "rule_id": l.rule_id,
            "action": l.action,
            "admin_id": l.admin_id,
            "details": l.details,
            "created_at": l.created_at.isoformat()
        }
        for l in logs
    ]
