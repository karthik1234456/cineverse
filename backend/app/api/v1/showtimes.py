from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.cinema import Auditorium, Seat
from app.models.auth import User
from app.schemas.showtime import ShowtimeSeatsResponse, SeatInventoryItem
from app.services.auth_service import get_current_user

router = APIRouter()


@router.get("/{showtime_id}/seats", response_model=ShowtimeSeatsResponse)
async def get_showtime_seats(
    showtime_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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

        seat_items.append(SeatInventoryItem(
            seat_id=inv.seat_id,
            category=inv.category,
            price=inv.price,
            status=inv.status,
            held_by_current_user=is_held_by_me,
            row=row,
            number=num,
            node_name=aud_seat.node_name if aud_seat else f"seat_{row}_{str(num).zfill(2)}",
            distance_to_screen=aud_seat.distance_to_screen if aud_seat else 10.0,
            vertical_angle_deg=aud_seat.vertical_angle_deg if aud_seat else 0.0,
            horizontal_angle_deg=aud_seat.horizontal_angle_deg if aud_seat else 0.0
        ))

    # Sort seats alphabetically A01...J10
    seat_items.sort(key=lambda s: (s.row, s.number))

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
        format=showtime.format,
        language=showtime.language,
        start_time=showtime.start_time,
        glb_path="/models/cineverse_auditorium_v2.web.glb",
        layout_path="/models/seat_layout_v2.json",
        trailer_url=showtime.movie.trailer_url if showtime.movie else None,
        poster_url=showtime.movie.poster_url if showtime.movie else None,
        seats=seat_items
    )

