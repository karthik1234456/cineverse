import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.waitlist import WaitlistEntry, WaitlistStatusEnum
from app.models.audit import Notification

logger = logging.getLogger("cineverse.waitlist")

MAX_ACTIVE_WAITLIST_PER_USER = 3
CLAIM_WINDOW_MINUTES = 10


async def join_waitlist(
    db: AsyncSession,
    user_id: int,
    showtime_id: int,
    desired_seats_count: int = 2,
    category: Optional[str] = None
) -> Dict[str, Any]:
    if desired_seats_count < 1 or desired_seats_count > 10:
        raise HTTPException(status_code=400, detail="Desired seats count must be between 1 and 10")

    showtime = await db.get(Showtime, showtime_id)
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    now = datetime.utcnow()
    if showtime.start_time <= now:
        raise HTTPException(status_code=400, detail="Cannot join waitlist for a showtime that has already started")

    # Check active waitlist abuse limits
    active_user_entries_count = await db.scalar(
        select(func.count(WaitlistEntry.id)).where(
            WaitlistEntry.user_id == user_id,
            WaitlistEntry.status.in_([WaitlistStatusEnum.ACTIVE, WaitlistStatusEnum.NOTIFIED])
        )
    ) or 0

    if active_user_entries_count >= MAX_ACTIVE_WAITLIST_PER_USER:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: You can only have up to {MAX_ACTIVE_WAITLIST_PER_USER} active waitlist entries at once."
        )

    # Check if user already on waitlist for this showtime
    existing = await db.scalar(
        select(WaitlistEntry).where(
            WaitlistEntry.user_id == user_id,
            WaitlistEntry.showtime_id == showtime_id,
            WaitlistEntry.status.in_([WaitlistStatusEnum.ACTIVE, WaitlistStatusEnum.NOTIFIED])
        )
    )
    if existing:
        return {
            "id": existing.id,
            "showtime_id": showtime_id,
            "user_id": user_id,
            "status": existing.status.value,
            "desired_seats_count": existing.desired_seats_count,
            "category": existing.category,
            "created_at": existing.created_at.isoformat(),
            "message": "Already registered on waitlist for this showtime"
        }

    entry = WaitlistEntry(
        user_id=user_id,
        showtime_id=showtime_id,
        desired_seats_count=desired_seats_count,
        category=category,
        status=WaitlistStatusEnum.ACTIVE,
        created_at=now
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Compute queue position
    position = await db.scalar(
        select(func.count(WaitlistEntry.id)).where(
            WaitlistEntry.showtime_id == showtime_id,
            WaitlistEntry.status == WaitlistStatusEnum.ACTIVE,
            WaitlistEntry.created_at <= entry.created_at
        )
    )

    return {
        "id": entry.id,
        "showtime_id": showtime_id,
        "user_id": user_id,
        "status": entry.status.value,
        "desired_seats_count": entry.desired_seats_count,
        "category": entry.category,
        "created_at": entry.created_at.isoformat(),
        "queue_position": position,
        "message": f"Successfully joined waitlist. Position in queue: {position}"
    }


async def get_user_waitlist_status(
    db: AsyncSession,
    user_id: int,
    showtime_id: int
) -> Optional[Dict[str, Any]]:
    # First expire overdue claims
    await expire_overdue_claims(db, showtime_id)

    entry = await db.scalar(
        select(WaitlistEntry).where(
            WaitlistEntry.user_id == user_id,
            WaitlistEntry.showtime_id == showtime_id,
            WaitlistEntry.status.in_([WaitlistStatusEnum.ACTIVE, WaitlistStatusEnum.NOTIFIED])
        )
    )
    if not entry:
        return None

    position = None
    if entry.status == WaitlistStatusEnum.ACTIVE:
        position = await db.scalar(
            select(func.count(WaitlistEntry.id)).where(
                WaitlistEntry.showtime_id == showtime_id,
                WaitlistEntry.status == WaitlistStatusEnum.ACTIVE,
                WaitlistEntry.created_at <= entry.created_at
            )
        )

    return {
        "id": entry.id,
        "showtime_id": showtime_id,
        "user_id": user_id,
        "status": entry.status.value,
        "desired_seats_count": entry.desired_seats_count,
        "category": entry.category,
        "created_at": entry.created_at.isoformat(),
        "notified_at": entry.notified_at.isoformat() if entry.notified_at else None,
        "claim_window_expires_at": entry.claim_window_expires_at.isoformat() if entry.claim_window_expires_at else None,
        "queue_position": position
    }


async def cancel_waitlist(
    db: AsyncSession,
    user_id: int,
    showtime_id: int
) -> Dict[str, Any]:
    entry = await db.scalar(
        select(WaitlistEntry).where(
            WaitlistEntry.user_id == user_id,
            WaitlistEntry.showtime_id == showtime_id,
            WaitlistEntry.status.in_([WaitlistStatusEnum.ACTIVE, WaitlistStatusEnum.NOTIFIED])
        )
    )
    if not entry:
        raise HTTPException(status_code=404, detail="No active waitlist entry found for this showtime")

    entry.status = WaitlistStatusEnum.CANCELLED
    await db.commit()
    return {"message": "Waitlist entry cancelled successfully"}


async def expire_overdue_claims(db: AsyncSession, showtime_id: Optional[int] = None) -> int:
    """Expires any NOTIFIED entries whose 10-minute claim window has elapsed."""
    now = datetime.utcnow()
    query = select(WaitlistEntry).where(
        WaitlistEntry.status == WaitlistStatusEnum.NOTIFIED,
        WaitlistEntry.claim_window_expires_at <= now
    )
    if showtime_id:
        query = query.where(WaitlistEntry.showtime_id == showtime_id)

    res = await db.execute(query)
    expired = res.scalars().all()
    for e in expired:
        e.status = WaitlistStatusEnum.EXPIRED
    if expired:
        await db.commit()
    return len(expired)


async def process_waitlist_on_release(
    db: AsyncSession,
    showtime_id: int,
    freed_seat_count: int
) -> List[int]:
    """FIFO fair notification when seats are freed. Returns list of notified user IDs."""
    if freed_seat_count <= 0:
        return []

    # 1. Expire overdue claims first
    await expire_overdue_claims(db, showtime_id)

    # 2. Fetch active entries in strict FIFO order
    stmt = (
        select(WaitlistEntry)
        .where(
            WaitlistEntry.showtime_id == showtime_id,
            WaitlistEntry.status == WaitlistStatusEnum.ACTIVE
        )
        .order_by(WaitlistEntry.created_at.asc())
    )
    res = await db.execute(stmt)
    active_entries = res.scalars().all()

    now = datetime.utcnow()
    notified_user_ids = []
    remaining_seats = freed_seat_count

    for entry in active_entries:
        if entry.desired_seats_count <= remaining_seats:
            entry.status = WaitlistStatusEnum.NOTIFIED
            entry.notified_at = now
            entry.claim_window_expires_at = now + timedelta(minutes=CLAIM_WINDOW_MINUTES)
            remaining_seats -= entry.desired_seats_count
            notified_user_ids.append(entry.user_id)

            # Record system notification
            notif = Notification(
                user_id=entry.user_id,
                title="Seats Released on CineVerse!",
                message=f"{entry.desired_seats_count} seats are now available for your waitlisted showtime. Claim window open for {CLAIM_WINDOW_MINUTES} minutes.",
                type="WAITLIST_RELEASE",
                created_at=now
            )
            db.add(notif)

            if remaining_seats <= 0:
                break

    if notified_user_ids:
        await db.commit()
        logger.info(f"Notified {len(notified_user_ids)} waitlist users for showtime {showtime_id}")

    return notified_user_ids

