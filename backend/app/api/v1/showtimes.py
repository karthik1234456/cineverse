from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.cinema import Auditorium, Seat
from app.models.auth import User
from app.schemas.showtime import ShowtimeSeatsResponse, SeatInventoryItem, TierSummaryItem
from app.services.auth_service import get_current_user

router = APIRouter()


@router.get("/{showtime_id}/seats", response_model=ShowtimeSeatsResponse)
async def get_showtime_seats(
    showtime_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Release expired holds for this showtime so inventory is always fresh
    now = datetime.utcnow()
    await db.execute(
        update(SeatInventory)
        .where(
            SeatInventory.showtime_id == showtime_id,
            SeatInventory.status.in_([SeatStatusEnum.HELD, SeatStatusEnum.PAYMENT_PENDING]),
            SeatInventory.hold_expires_at.is_not(None),
            SeatInventory.hold_expires_at <= now
        )
        .values(
            status=SeatStatusEnum.AVAILABLE,
            hold_id=None,
            hold_expires_at=None,
            held_by_user_id=None
        )
    )
    await db.commit()

    stmt = (
        select(Showtime)
        .where(Showtime.id == showtime_id)
        .options(
            selectinload(Showtime.movie),
            selectinload(Showtime.cinema),
            selectinload(Showtime.auditorium).selectinload(Auditorium.seats),
            selectinload(Showtime.seat_inventory)
        )
    )
    result = await db.execute(stmt)
    showtime = result.scalars().first()

    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    # Map auditorium seats by seat_id
    aud_seats = {s.seat_id: s for s in showtime.auditorium.seats} if showtime.auditorium else {}

    layout_data = showtime.auditorium.layout_data if showtime.auditorium and showtime.auditorium.layout_data else {}
    is_motion = bool(layout_data.get("is_motion_hall") or "dolby_atmos_4dx" in str(layout_data.get("theatre_type", "")))
    seat_to_pod = {}
    if layout_data.get("pods"):
        for p in layout_data["pods"]:
            for s_id in p.get("seat_ids", []):
                seat_to_pod[s_id] = p.get("pod_id")

    seat_items = []
    current_user_id = current_user.id if current_user else None

    for inv in showtime.seat_inventory:
        aud_seat = aud_seats.get(inv.seat_id)
        is_held_by_me = (
            inv.status == SeatStatusEnum.HELD and
            current_user_id is not None and
            inv.held_by_user_id == current_user_id
        )

        row = inv.seat_id[0] if inv.seat_id else "A"
        try:
            num = int(inv.seat_id[1:])
        except ValueError:
            num = 1

        quote_id = f"cv-quote-{showtime.id}-{int(datetime.utcnow().timestamp())}"

        is_acc = aud_seat.is_accessible if aud_seat else False
        is_comp = aud_seat.is_companion if aud_seat else False
        pod_id_val = seat_to_pod.get(inv.seat_id)
        s_type = "accessible" if is_acc else ("companion" if is_comp else ("motion" if is_motion else "standard"))

        seat_items.append(SeatInventoryItem(
            seat_id=inv.seat_id,
            category=inv.category,
            price=inv.price,
            currency="INR",
            quote_id=quote_id,
            status=inv.status,
            held_by_current_user=is_held_by_me,
            row=row,
            number=num,
            node_name=aud_seat.node_name if aud_seat else f"seat_{row}_{str(num).zfill(2)}",
            distance_to_screen=aud_seat.distance_to_screen if aud_seat else 10.0,
            vertical_angle_deg=aud_seat.vertical_angle_deg if aud_seat else 0.0,
            horizontal_angle_deg=aud_seat.horizontal_angle_deg if aud_seat else 0.0,
            is_accessible=is_acc,
            is_companion=is_comp,
            seat_type=s_type,
            pod_id=pod_id_val,
            motion_zone="all" if is_motion else None,
        ))

    # Sort seats alphabetically A01...J10
    seat_items.sort(key=lambda s: (s.row, s.number))

    # Build dynamic tier summaries directly from seat inventories
    tier_map = {}
    tier_colors = {
        "front": "#8D5B28",
        "prime": "#1E40AF",
        "premier": "#9F1239"
    }
    for item in seat_items:
        cat_key = item.category.lower()
        if cat_key not in tier_map:
            tier_map[cat_key] = {
                "name": item.category,
                "category": cat_key,
                "price": item.price,
                "currency": "INR",
                "rows": set(),
                "color": tier_colors.get(cat_key, "#4A4056")
            }
        tier_map[cat_key]["rows"].add(item.row)
        tier_map[cat_key]["price"] = item.price

    tier_order = ["front", "prime", "premier"]
    tiers = []
    for k in tier_order:
        if k in tier_map:
            t = tier_map[k]
            tiers.append(TierSummaryItem(
                name=t["name"],
                category=t["category"],
                price=t["price"],
                currency=t["currency"],
                rows=sorted(list(t["rows"])),
                color=t["color"]
            ))
    for k, t in tier_map.items():
        if k not in tier_order:
            tiers.append(TierSummaryItem(
                name=t["name"],
                category=t["category"],
                price=t["price"],
                currency=t["currency"],
                rows=sorted(list(t["rows"])),
                color=t["color"]
            ))

    quote_id = f"cv-quote-{showtime.id}-{int(datetime.utcnow().timestamp())}"

    return ShowtimeSeatsResponse(
        showtime_id=showtime.id,
        movie_id=showtime.movie_id,
        movie_title=showtime.movie.title if showtime.movie else "Movie",
        cinema_id=showtime.cinema_id,
        cinema_name=showtime.cinema.name if showtime.cinema else "Cinema",
        auditorium_id=showtime.auditorium_id,
        auditorium_name=showtime.auditorium.name if showtime.auditorium else "Screen 1",
        screen_type=showtime.auditorium.screen_type if showtime.auditorium else "IMAX 3D",
        has_3d_preview=showtime.auditorium.has_3d_preview if showtime.auditorium else True,
        layout_data=showtime.auditorium.layout_data if showtime.auditorium else None,
        layout_signature=showtime.auditorium.layout_data.get("layout_signature") if showtime.auditorium and showtime.auditorium.layout_data else None,
        format=showtime.format,
        language=showtime.language,
        start_time=showtime.start_time,
        currency="INR",
        quote_id=quote_id,
        glb_path="/models/cineverse_auditorium_v2.web.glb",
        layout_path="/models/seat_layout_v2.json",
        trailer_url=showtime.movie.trailer_url if showtime.movie else None,
        poster_url=showtime.movie.poster_url if showtime.movie else None,
        banner_url=showtime.movie.banner_url if showtime.movie else None,
        dominant_color=showtime.movie.dominant_color if showtime.movie else None,
        glimpse_url=showtime.movie.glimpse_url if showtime.movie else None,
        glimpse_webm_url=showtime.movie.glimpse_webm_url if showtime.movie else None,
        glimpse_720p_url=showtime.movie.glimpse_720p_url if showtime.movie else None,
        tiers=tiers,
        seats=seat_items
    )


@router.get("/{showtime_id}/best-seats")
async def get_best_seats_for_showtime(
    showtime_id: int,
    n: int = 2,
    category: Optional[str] = None,
    preference: Optional[str] = "balanced",
    db: AsyncSession = Depends(get_db)
):
    """Finds best contiguous same-row seats for N people using geometric sightline scoring."""
    if n < 1:
        raise HTTPException(status_code=400, detail="Number of seats must be at least 1")
    if n > 10:
        raise HTTPException(status_code=400, detail="Cannot search for more than 10 seats at once")

    stmt = select(Showtime).where(Showtime.id == showtime_id).options(selectinload(Showtime.seat_inventory))
    result = await db.execute(stmt)
    showtime = result.scalars().first()

    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    from app.services.seat_scoring import get_layout_seats, best_available

    layout_seats = get_layout_seats()
    inventory_status = {
        inv.seat_id: inv.status.value.lower()
        for inv in showtime.seat_inventory
    }

    best = best_available(
        seats=layout_seats,
        status=inventory_status,
        n=n,
        preference=preference,
        category=category
    )

    if not best:
        raise HTTPException(status_code=404, detail="No suitable seats available for the requested count and preferences")

    return {
        "showtime_id": showtime_id,
        "suggested_seats": best["seat_ids"],
        "avg_score": best["avg_score"],
        "split": best["split"],
        "orphan_seats": best["orphan_seats"],
        "reasons": best["reasons"],
        "disclaimer": "Geometric viewing angle estimate based on screen distance and FOV. Not a physical cinema measurement."
    }


