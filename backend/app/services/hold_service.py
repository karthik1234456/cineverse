import uuid
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import settings
from app.models.showtime import SeatInventory, SeatStatusEnum
from app.redis_client import get_redis_client

logger = logging.getLogger("cineverse.hold")


async def broadcast_seat_update(showtime_id: int, updates: dict):
    try:
        redis = await get_redis_client()
        channel = f"ws:showtime:{showtime_id}"
        await redis.publish(channel, json.dumps(updates))
    except Exception as exc:
        logger.warning(f"Failed to broadcast seat update over redis: {exc}")


async def hold_seats(
    db: AsyncSession,
    showtime_id: int,
    seat_ids: List[str],
    user_id: Optional[int] = None
) -> dict:
    if not seat_ids:
        raise HTTPException(status_code=400, detail="No seats specified")

    if len(seat_ids) > settings.MAX_SEATS_PER_BOOKING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot hold more than {settings.MAX_SEATS_PER_BOOKING} seats at once"
        )

    # Clean up expired holds for this showtime first
    now = datetime.utcnow()
    await db.execute(
        update(SeatInventory)
        .where(
            SeatInventory.showtime_id == showtime_id,
            SeatInventory.status == SeatStatusEnum.HELD,
            SeatInventory.hold_expires_at <= now
        )
        .values(
            status=SeatStatusEnum.AVAILABLE,
            hold_id=None,
            hold_expires_at=None,
            held_by_user_id=None
        )
    )

    # Query requested seats
    stmt = (
        select(SeatInventory)
        .where(
            SeatInventory.showtime_id == showtime_id,
            SeatInventory.seat_id.in_(seat_ids)
        )
    )
    # Check if database supports with_for_update (Postgres does, SQLite does not)
    if "postgresql" in settings.DATABASE_URL:
        stmt = stmt.with_for_update()

    result = await db.execute(stmt)
    seats = result.scalars().all()

    found_ids = {s.seat_id for s in seats}
    missing_ids = set(seat_ids) - found_ids
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Seat(s) not found for showtime: {list(missing_ids)}"
        )

    # Verify all seats are AVAILABLE
    unavailable_seats = [
        s.seat_id for s in seats
        if s.status != SeatStatusEnum.AVAILABLE
    ]
    if unavailable_seats:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Seat(s) are no longer available: {unavailable_seats}"
        )

    # Create new hold
    hold_id = f"hold_{uuid.uuid4().hex[:12]}"
    expires_at = now + timedelta(minutes=settings.HOLD_DURATION_MINUTES)
    duration_seconds = settings.HOLD_DURATION_MINUTES * 60

    for s in seats:
        s.status = SeatStatusEnum.HELD
        s.hold_id = hold_id
        s.hold_expires_at = expires_at
        s.held_by_user_id = user_id

    await db.commit()

    # Store hold in Redis
    try:
        redis = await get_redis_client()
        hold_payload = {
            "hold_id": hold_id,
            "showtime_id": showtime_id,
            "seat_ids": seat_ids,
            "user_id": user_id,
            "expires_at": expires_at.isoformat(),
            "extensions": 0
        }
        await redis.setex(f"seat_hold:{hold_id}", duration_seconds, json.dumps(hold_payload))
    except Exception as exc:
        logger.warning(f"Redis hold tracking failed: {exc}")

    # Broadcast to websocket
    await broadcast_seat_update(showtime_id, {
        "event": "SEATS_HELD",
        "showtime_id": showtime_id,
        "hold_id": hold_id,
        "seat_ids": seat_ids,
        "status": "HELD"
    })

    return {
        "hold_id": hold_id,
        "showtime_id": showtime_id,
        "held_seats": seat_ids,
        "expires_at": expires_at,
        "hold_duration_seconds": duration_seconds
    }


async def release_seats(
    db: AsyncSession,
    hold_id: str,
    seat_ids: Optional[List[str]] = None
) -> dict:
    stmt = select(SeatInventory).where(SeatInventory.hold_id == hold_id)
    if seat_ids:
        stmt = stmt.where(SeatInventory.seat_id.in_(seat_ids))

    result = await db.execute(stmt)
    seats = result.scalars().all()

    if not seats:
        return {"released": []}

    showtime_id = seats[0].showtime_id
    released_seats = []
    for s in seats:
        released_seats.append(s.seat_id)
        s.status = SeatStatusEnum.AVAILABLE
        s.hold_id = None
        s.hold_expires_at = None
        s.held_by_user_id = None

    await db.commit()

    # Clean up Redis
    try:
        redis = await get_redis_client()
        await redis.delete(f"seat_hold:{hold_id}")
    except Exception:
        pass

    # Broadcast
    await broadcast_seat_update(showtime_id, {
        "event": "SEATS_RELEASED",
        "showtime_id": showtime_id,
        "seat_ids": released_seats,
        "status": "AVAILABLE"
    })

    return {"released": released_seats}


async def extend_hold(db: AsyncSession, hold_id: str) -> dict:
    stmt = select(SeatInventory).where(SeatInventory.hold_id == hold_id)
    result = await db.execute(stmt)
    seats = result.scalars().all()

    if not seats:
        raise HTTPException(status_code=404, detail="Hold not found or already expired")

    now = datetime.utcnow()
    # Check if already expired
    if seats[0].hold_expires_at and seats[0].hold_expires_at <= now:
        raise HTTPException(status_code=400, detail="Cannot extend an already expired hold")

    new_expiry = (seats[0].hold_expires_at or now) + timedelta(minutes=settings.HOLD_EXTENSION_MINUTES)
    for s in seats:
        s.hold_expires_at = new_expiry

    await db.commit()

    return {
        "hold_id": hold_id,
        "new_expires_at": new_expiry,
        "extended_by_minutes": settings.HOLD_EXTENSION_MINUTES
    }

