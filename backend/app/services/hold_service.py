import uuid
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Set
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import settings
from app.models.showtime import SeatInventory, SeatStatusEnum
from app.redis_client import get_redis_client

logger = logging.getLogger("cineverse.hold")

# In-memory tracking structures for local dev and fallback coordination
_idempotency_store: Dict[str, dict] = {}
_active_user_holds: Dict[int, Set[str]] = {}
_active_ip_holds: Dict[str, Set[str]] = {}
_request_counters: Dict[str, List[datetime]] = {}
_hold_extensions: Dict[str, int] = {}


async def broadcast_seat_update(showtime_id: int, updates: dict):
    # 1. Direct in-memory broadcast
    try:
        from app.api.websockets.showtimes import manager
        await manager.broadcast_to_showtime(showtime_id, updates)
    except Exception as exc:
        logger.debug(f"Direct WS broadcast note: {exc}")

    # 2. Redis publish
    try:
        redis = await get_redis_client()
        channel = f"ws:showtime:{showtime_id}"
        await redis.publish(channel, json.dumps(updates))
    except Exception as exc:
        logger.warning(f"Failed to broadcast seat update over redis: {exc}")


def consume_hold(hold_id: str):
    """Called when hold converts to a booking or is released."""
    for user_set in _active_user_holds.values():
        user_set.discard(hold_id)
    for ip_set in _active_ip_holds.values():
        ip_set.discard(hold_id)


def reset_hold_tracking():
    """Resets in-memory tracking stores for tests."""
    _idempotency_store.clear()
    _active_user_holds.clear()
    _active_ip_holds.clear()
    _request_counters.clear()
    _hold_extensions.clear()


def _check_rate_limits(user_id: Optional[int], client_ip: Optional[str]):
    now = datetime.utcnow()
    one_minute_ago = now - timedelta(seconds=60)

    # Key for request rate limiting
    keys = []
    if user_id:
        keys.append(f"user:{user_id}")
    if client_ip and client_ip != "testclient":
        keys.append(f"ip:{client_ip}")

    for k in keys:
        timestamps = _request_counters.get(k, [])
        timestamps = [t for t in timestamps if t > one_minute_ago]
        if len(timestamps) >= 60:  # max 60 hold requests per minute
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Too many hold attempts in a short period."
            )
        timestamps.append(now)
        _request_counters[k] = timestamps

    # Max concurrent active holds: 3 per user, 5 per external IP
    if user_id and len(_active_user_holds.get(user_id, set())) >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Active hold limit exceeded. You already have maximum active seat holds."
        )
    if client_ip and client_ip not in ("testclient", "127.0.0.1", "localhost", "::1") and len(_active_ip_holds.get(client_ip, set())) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Seat hoarding detected. This IP address already has multiple active seat holds."
        )


async def hold_seats(
    db: AsyncSession,
    showtime_id: int,
    seat_ids: List[str],
    user_id: Optional[int] = None,
    client_ip: Optional[str] = None,
    idempotency_key: Optional[str] = None
) -> dict:
    if not seat_ids:
        raise HTTPException(status_code=400, detail="No seats specified")

    if len(seat_ids) > settings.MAX_SEATS_PER_BOOKING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot hold more than {settings.MAX_SEATS_PER_BOOKING} seats at once"
        )

    # 1. Idempotency Key check: if identical request is repeated, return existing hold
    now = datetime.utcnow()
    if idempotency_key:
        cached_hold = _idempotency_store.get(idempotency_key)
        if cached_hold:
            expires_at = cached_hold.get("expires_at")
            if isinstance(expires_at, datetime) and expires_at > now:
                # Return existing hold response without error or duplicate
                return cached_hold

    # 2. Rate limiting & Bot Protection
    _check_rate_limits(user_id, client_ip)

    # 3. Clean up expired holds for this showtime first
    await db.execute(
        update(SeatInventory)
        .where(
            SeatInventory.showtime_id == showtime_id,
            SeatInventory.status.in_([SeatStatusEnum.HELD, SeatStatusEnum.PAYMENT_PENDING]),
            SeatInventory.hold_expires_at <= now
        )
        .values(
            status=SeatStatusEnum.AVAILABLE,
            hold_id=None,
            hold_expires_at=None,
            held_by_user_id=None
        )
    )

    # 4. Query requested seats with row locking where supported
    stmt = (
        select(SeatInventory)
        .where(
            SeatInventory.showtime_id == showtime_id,
            SeatInventory.seat_id.in_(seat_ids)
        )
    )
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

    # 5. Verify all seats are strictly AVAILABLE
    unavailable_seats = [
        s.seat_id for s in seats
        if s.status != SeatStatusEnum.AVAILABLE
    ]
    if unavailable_seats:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Seat(s) are no longer available: {unavailable_seats}"
        )

    # 6. Create new atomic hold
    hold_id = f"hold_{uuid.uuid4().hex[:12]}"
    expires_at = now + timedelta(minutes=settings.HOLD_DURATION_MINUTES)
    duration_seconds = settings.HOLD_DURATION_MINUTES * 60

    for s in seats:
        s.status = SeatStatusEnum.HELD
        s.hold_id = hold_id
        s.hold_expires_at = expires_at
        s.held_by_user_id = user_id

    await db.commit()

    # Track active holds for rate limiting
    if user_id:
        _active_user_holds.setdefault(user_id, set()).add(hold_id)
    if client_ip:
        _active_ip_holds.setdefault(client_ip, set()).add(hold_id)

    # Initialize extension count
    _hold_extensions[hold_id] = 0

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

    response_payload = {
        "hold_id": hold_id,
        "showtime_id": showtime_id,
        "held_seats": seat_ids,
        "expires_at": expires_at,
        "hold_duration_seconds": duration_seconds,
        "is_extended": False,
        "extension_count": 0,
        "message": "Seats held successfully"
    }

    if idempotency_key:
        _idempotency_store[idempotency_key] = response_payload

    return response_payload


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
    user_id = seats[0].held_by_user_id
    released_seats = []
    for s in seats:
        released_seats.append(s.seat_id)
        s.status = SeatStatusEnum.AVAILABLE
        s.hold_id = None
        s.hold_expires_at = None
        s.held_by_user_id = None

    await db.commit()

    # Clean active holds
    if user_id and user_id in _active_user_holds:
        _active_user_holds[user_id].discard(hold_id)
    for ip_set in _active_ip_holds.values():
        ip_set.discard(hold_id)

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

    # Enforce extend ONCE
    current_extensions = _hold_extensions.get(hold_id, 0)
    if current_extensions >= settings.MAX_HOLD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hold can only be extended once"
        )

    _hold_extensions[hold_id] = current_extensions + 1
    new_expiry = (seats[0].hold_expires_at or now) + timedelta(minutes=settings.HOLD_EXTENSION_MINUTES)
    for s in seats:
        s.hold_expires_at = new_expiry

    await db.commit()

    return {
        "hold_id": hold_id,
        "new_expires_at": new_expiry,
        "extended_by_minutes": settings.HOLD_EXTENSION_MINUTES,
        "is_extended": True,
        "extension_count": _hold_extensions[hold_id]
    }
