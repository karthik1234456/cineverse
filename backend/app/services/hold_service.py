import uuid
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Set
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import settings
from app.models.showtime import SeatInventory, SeatStatusEnum, Showtime
from app.models.booking import FnbItem
from app.models.auth import RoleEnum, User
from app.redis_client import get_redis_client
from app.services.geo_service import generate_directions_url
from sqlalchemy.orm import selectinload

logger = logging.getLogger("cineverse.hold")

# In-memory tracking structures for local dev and fallback coordination
_idempotency_store: Dict[str, dict] = {}
_active_user_holds: Dict[int, Set[str]] = {}
_active_ip_holds: Dict[str, Set[str]] = {}
_request_counters: Dict[str, List[datetime]] = {}
_hold_extensions: Dict[str, int] = {}
_hold_metadata: Dict[str, dict] = {}


def get_hold_metadata(hold_id: str) -> dict:
    return _hold_metadata.get(hold_id, {"addons": [], "coupon_code": None})


def set_hold_addons(hold_id: str, addons: List[dict]):
    meta = _hold_metadata.setdefault(hold_id, {"addons": [], "coupon_code": None})
    meta["addons"] = addons


def set_hold_coupon(hold_id: str, coupon_code: Optional[str]):
    meta = _hold_metadata.setdefault(hold_id, {"addons": [], "coupon_code": None})
    meta["coupon_code"] = coupon_code


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
    _hold_metadata.pop(hold_id, None)


def reset_hold_tracking():
    """Resets in-memory tracking stores for tests."""
    _idempotency_store.clear()
    _active_user_holds.clear()
    _active_ip_holds.clear()
    _request_counters.clear()
    _hold_extensions.clear()
    _hold_metadata.clear()


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

    # 2.5 Server-enforced recliner pair integrity
    st_res = await db.execute(select(Showtime).where(Showtime.id == showtime_id))
    st_obj = st_res.scalar_one_or_none()
    if st_obj:
        from app.models.cinema import Auditorium
        aud_res = await db.execute(select(Auditorium).where(Auditorium.id == st_obj.auditorium_id))
        aud_obj = aud_res.scalar_one_or_none()
        if aud_obj and aud_obj.layout_data:
            recliner_pairs = aud_obj.layout_data.get("recliner_pairs", [])
            pair_map = {}
            for p in recliner_pairs:
                if len(p) == 2:
                    pair_map[p[0]] = p[1]
                    pair_map[p[1]] = p[0]

            expanded_seat_ids = list(seat_ids)
            for sid in seat_ids:
                partner = pair_map.get(sid)
                if partner and partner not in expanded_seat_ids:
                    expanded_seat_ids.append(partner)
            seat_ids = expanded_seat_ids

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
        s.booking_id = None

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


async def get_hold_quote(db: AsyncSession, hold_id: str, current_user: User) -> dict:
    """
    Fetches the locked server quote for an active seat hold.
    Enforces login, active status, and strict ownership (403 for other users, 404 for expired/missing).
    Computes ticket subtotal, fees, GST, addons, and applied discounts on the server.
    """
    stmt = (
        select(SeatInventory)
        .where(SeatInventory.hold_id == hold_id)
        .order_by(SeatInventory.seat_id)
    )
    result = await db.execute(stmt)
    seats = result.scalars().all()
    if not seats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seat hold not found or has expired. Please select seats again."
        )

    now = datetime.utcnow()
    # 1. Expiry check
    if seats[0].hold_expires_at and seats[0].hold_expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seat hold has expired. Please select seats again."
        )

    # 2. Replay check: already converted to a booking
    if any(s.status == SeatStatusEnum.BOOKED or s.booking_id is not None for s in seats):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This seat hold has already been converted to a confirmed booking."
        )

    # 3. Ownership / IDOR check: must belong to current user (unless admin)
    if current_user.role != RoleEnum.ADMIN and seats[0].held_by_user_id and seats[0].held_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this seat hold reservation."
        )

    # 4. Fetch Showtime with Movie, Cinema, and Auditorium
    showtime_id = seats[0].showtime_id
    st_stmt = (
        select(Showtime)
        .where(Showtime.id == showtime_id)
        .options(
            selectinload(Showtime.movie),
            selectinload(Showtime.cinema),
            selectinload(Showtime.auditorium)
        )
    )
    st_res = await db.execute(st_stmt)
    showtime = st_res.scalars().first()
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    # 5. Calculate locked ticket pricing
    held_seats_quotes = [
        {
            "seat_id": s.seat_id,
            "category": s.category,
            "price": s.price,
            "price_display": f"₹{int(round(s.price))}"
        }
        for s in seats
    ]
    ticket_subtotal = sum(s.price for s in seats)
    ticket_count = len(seats)
    convenience_fee = round(settings.CONVENIENCE_FEE_PER_TICKET * ticket_count, 2)
    gst_amount = round((convenience_fee * settings.GST_PERCENTAGE) / 100.0, 2)

    # 6. Retrieve attached add-ons from server hold metadata
    meta = get_hold_metadata(hold_id)
    addons_data = meta.get("addons", [])
    addons_subtotal = 0.0
    addon_quotes = []
    if addons_data:
        fnb_ids = [a["fnb_item_id"] for a in addons_data]
        fnb_stmt = select(FnbItem).where(FnbItem.id.in_(fnb_ids))
        fnb_res = await db.execute(fnb_stmt)
        fnb_map = {item.id: item for item in fnb_res.scalars().all()}
        for a in addons_data:
            item = fnb_map.get(a["fnb_item_id"])
            if item:
                qty = a["quantity"]
                line_total = round(item.price * qty, 2)
                addons_subtotal += line_total
                addon_quotes.append({
                    "fnb_item_id": item.id,
                    "name": item.name,
                    "quantity": qty,
                    "unit_price": item.price,
                    "unit_price_display": f"₹{int(round(item.price))}",
                    "line_total": line_total,
                    "line_total_display": f"₹{int(round(line_total))}"
                })

    # 7. Validate attached coupon against locked ticket subtotal
    discount_amount = 0.0
    applied_coupon_quote = None
    coupon_code = meta.get("coupon_code")
    if coupon_code:
        try:
            from app.services.booking_service import validate_coupon
            coupon, discount_amount = await validate_coupon(db, coupon_code, current_user.id, ticket_subtotal)
            applied_coupon_quote = {
                "code": coupon.code,
                "discount_amount": discount_amount,
                "discount_amount_display": f"₹{int(round(discount_amount))}",
                "message": f"Coupon {coupon.code} applied successfully"
            }
        except Exception:
            # Clear invalid coupon from hold metadata
            meta["coupon_code"] = None
            discount_amount = 0.0

    final_total = max(0.0, round(ticket_subtotal + convenience_fee + gst_amount + addons_subtotal - discount_amount, 2))
    duration_left = max(0, int(((seats[0].hold_expires_at or now) - now).total_seconds()))

    return {
        "hold_id": hold_id,
        "showtime_id": showtime_id,
        "movie_id": showtime.movie_id,
        "movie_title": showtime.movie.title if showtime.movie else "Movie",
        "movie_poster_url": showtime.movie.poster_url if showtime.movie else "",
        "movie_banner_url": showtime.movie.banner_url if showtime.movie else None,
        "movie_dominant_color": showtime.movie.dominant_color if showtime.movie else None,
        "movie_glimpse_url": showtime.movie.glimpse_url if showtime.movie else None,
        "movie_glimpse_webm_url": showtime.movie.glimpse_webm_url if showtime.movie else None,
        "movie_glimpse_720p_url": showtime.movie.glimpse_720p_url if showtime.movie else None,
        "cinema_name": showtime.cinema.name if showtime.cinema else "Cinema",
        "cinema_address": showtime.cinema.address if showtime.cinema else "",
        "cinema_latitude": showtime.cinema.latitude if showtime.cinema else None,
        "cinema_longitude": showtime.cinema.longitude if showtime.cinema else None,
        "cinema_pincode": showtime.cinema.pincode if showtime.cinema else None,
        "cinema_landmark": showtime.cinema.landmark if showtime.cinema else None,
        "cinema_parking": showtime.cinema.parking if showtime.cinema else None,
        "cinema_transit_stop": showtime.cinema.transit_stop if showtime.cinema else None,
        "directions_url": generate_directions_url(showtime.cinema.latitude, showtime.cinema.longitude) if (showtime.cinema and showtime.cinema.latitude and showtime.cinema.longitude) else None,
        "auditorium_name": showtime.auditorium.name if showtime.auditorium else "Auditorium",
        "screen_type": showtime.auditorium.screen_type if showtime.auditorium else "Standard",
        "start_time": showtime.start_time,
        "expires_at": seats[0].hold_expires_at or now,
        "hold_duration_seconds": duration_left,
        "held_seats": held_seats_quotes,
        "ticket_subtotal": ticket_subtotal,
        "ticket_subtotal_display": f"₹{int(round(ticket_subtotal))}",
        "convenience_fee": convenience_fee,
        "convenience_fee_display": f"₹{int(round(convenience_fee))}",
        "gst_amount": gst_amount,
        "gst_amount_display": f"₹{int(round(gst_amount))}",
        "addons": addon_quotes,
        "addons_subtotal": addons_subtotal,
        "addons_subtotal_display": f"₹{int(round(addons_subtotal))}",
        "applied_coupon": applied_coupon_quote,
        "discount_amount": discount_amount,
        "discount_amount_display": f"₹{int(round(discount_amount))}",
        "final_total": final_total,
        "final_total_display": f"₹{int(round(final_total))}",
        "price_lock_guarantee": "The price shown at checkout is final"
    }


async def update_hold_addons(
    db: AsyncSession,
    hold_id: str,
    addons: List[dict],
    current_user: User
) -> dict:
    """Updates selected F&B add-ons on the server hold and returns updated quote."""
    # First verify permissions and hold validity
    await get_hold_quote(db, hold_id, current_user)
    # Save addons to server metadata
    set_hold_addons(hold_id, addons)
    # Return updated locked quote
    return await get_hold_quote(db, hold_id, current_user)


async def apply_hold_coupon(
    db: AsyncSession,
    hold_id: str,
    code: str,
    current_user: User
) -> dict:
    """Applies a promo coupon code to the server hold and returns updated quote."""
    quote = await get_hold_quote(db, hold_id, current_user)
    cleaned_code = code.strip().upper()
    if not cleaned_code:
        set_hold_coupon(hold_id, None)
        return await get_hold_quote(db, hold_id, current_user)

    from app.services.booking_service import validate_coupon
    ticket_subtotal = quote["ticket_subtotal"]
    coupon, discount = await validate_coupon(db, cleaned_code, current_user.id, ticket_subtotal)
    set_hold_coupon(hold_id, coupon.code)
    return await get_hold_quote(db, hold_id, current_user)
