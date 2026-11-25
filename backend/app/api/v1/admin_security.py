from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.models.auth import User, RoleEnum
from app.services.auth_service import require_role
from app.core.fraud_logger import (
    get_security_metrics,
    get_blocked_targets,
    block_target,
    unblock_target
)

router = APIRouter(prefix="/admin/security", tags=["Admin Security & Abuse Protection"])


class BlockTargetRequest(BaseModel):
    target_type: str = Field(..., description="'ip' or 'user'")
    target: Optional[str] = None
    target_id: Optional[str] = None
    duration_minutes: int = Field(60, ge=1, le=10080, description="Block duration in minutes (max 7 days)")
    reason: str = Field("Temporary block due to policy violation", description="Administrative reason")

    def get_target(self) -> str:
        t = self.target or self.target_id
        if not t:
            raise HTTPException(status_code=400, detail="target or target_id is required")
        return t


class UnblockTargetRequest(BaseModel):
    target_type: str = Field(..., description="'ip' or 'user'")
    target: Optional[str] = None
    target_id: Optional[str] = None

    def get_target(self) -> str:
        t = self.target or self.target_id
        if not t:
            raise HTTPException(status_code=400, detail="target or target_id is required")
        return t


@router.get("/metrics")
async def get_fraud_metrics(
    current_user: User = Depends(require_role([RoleEnum.ADMIN]))
):
    """Fetches high-level security telemetry, recent fraud signals, and threshold alerts."""
    return await get_security_metrics()


@router.get("/alerts")
async def get_fraud_alerts(
    current_user: User = Depends(require_role([RoleEnum.ADMIN]))
):
    """Fetches list of active security and anomaly threshold alerts."""
    metrics = await get_security_metrics()
    return {"alerts": metrics.get("recent_alerts", [])}


@router.get("/blocked")
async def list_blocked_entities(
    current_user: User = Depends(require_role([RoleEnum.ADMIN]))
):
    """Lists all actively blocked IP addresses and user accounts with remaining TTL."""
    blocked = await get_blocked_targets()
    return {"blocked": blocked, "total": len(blocked)}


@router.post("/block")
async def admin_block_target(
    req: BlockTargetRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN]))
):
    """Temporarily blocks an IP address or customer account from accessing the platform."""
    if req.target_type not in ("ip", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_type must be either 'ip' or 'user'"
        )

    target = req.get_target().strip()
    await block_target(
        target_type=req.target_type,
        target=target,
        duration_minutes=req.duration_minutes,
        reason=req.reason.strip()
    )
    return {
        "status": "blocked",
        "message": f"Successfully blocked {req.target_type} '{target}' for {req.duration_minutes} minutes.",
        "target_type": req.target_type,
        "target": target,
        "duration_minutes": req.duration_minutes
    }


@router.post("/unblock")
async def admin_unblock_target(
    req: UnblockTargetRequest,
    current_user: User = Depends(require_role([RoleEnum.ADMIN]))
):
    """Lifts a block on an IP address or customer account immediately."""
    if req.target_type not in ("ip", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_type must be either 'ip' or 'user'"
        )

    target = req.get_target().strip()
    success = await unblock_target(target_type=req.target_type, target=target)
    if not success:
        return {
            "status": "not_found",
            "message": f"No active block found for {req.target_type} '{target}'."
        }
    return {
        "status": "unblocked",
        "message": f"Successfully unblocked {req.target_type} '{target}'."
    }
