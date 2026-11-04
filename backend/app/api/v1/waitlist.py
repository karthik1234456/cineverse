from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.auth import User
from app.services.auth_service import get_current_user
from app.services.waitlist_service import (
    join_waitlist as svc_join_waitlist,
    get_user_waitlist_status as svc_get_status,
    cancel_waitlist as svc_cancel_waitlist,
)

router = APIRouter()


class JoinWaitlistRequest(BaseModel):
    desired_seats_count: int = Field(default=2, ge=1, le=10)
    category: Optional[str] = None


@router.post("/showtimes/{showtime_id}/waitlist")
async def join_showtime_waitlist(
    showtime_id: int,
    body: JoinWaitlistRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fair FIFO waitlist registration when a show is full or nearing capacity."""
    return await svc_join_waitlist(
        db=db,
        user_id=current_user.id,
        showtime_id=showtime_id,
        desired_seats_count=body.desired_seats_count,
        category=body.category
    )


@router.get("/showtimes/{showtime_id}/waitlist")
async def get_showtime_waitlist_status(
    showtime_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Checks the calling user's waitlist position and claim window."""
    status = await svc_get_status(
        db=db,
        user_id=current_user.id,
        showtime_id=showtime_id
    )
    if not status:
        return {"is_waitlisted": False, "status": None}
    return {"is_waitlisted": True, **status}


@router.delete("/showtimes/{showtime_id}/waitlist")
async def cancel_showtime_waitlist(
    showtime_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Opt-out / cancel the user's active waitlist entry."""
    return await svc_cancel_waitlist(
        db=db,
        user_id=current_user.id,
        showtime_id=showtime_id
    )

