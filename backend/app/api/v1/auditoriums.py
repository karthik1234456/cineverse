import json
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.cinema import Auditorium, Seat
from app.schemas.cinema import AuditoriumResponse

router = APIRouter()


@router.get("/{auditorium_id}", response_model=AuditoriumResponse)
async def get_auditorium(auditorium_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Auditorium)
        .where(Auditorium.id == auditorium_id)
        .options(
            selectinload(Auditorium.screen_format),
            selectinload(Auditorium.sound_system),
            selectinload(Auditorium.projection_type),
        )
    )
    result = await db.execute(stmt)
    aud = result.scalars().first()
    if not aud:
        raise HTTPException(status_code=404, detail="Auditorium not found")
    return AuditoriumResponse(
        id=aud.id,
        cinema_id=aud.cinema_id,
        name=aud.name,
        screen_type=aud.screen_format_name,
        total_seats=aud.total_seats,
        has_3d_preview=aud.has_3d_preview,
        layout_data=aud.layout_data,
        glb_path="/models/cineverse_auditorium_v2.web.glb",
        layout_path="/models/seat_layout_v2.json",
        screen_format_id=aud.screen_format_id,
        sound_system_id=aud.sound_system_id,
        projection_type_id=aud.projection_type_id,
        screen_format_name=aud.screen_format_name,
        sound_system_name=aud.sound_system_name,
        projection_type_name=aud.projection_type_name,
        tech_specs_display=aud.tech_specs_display,
        requires_glasses=aud.screen_format.requires_glasses if aud.screen_format else ("3D" in aud.screen_format_name),
        confirmed_with_cinema=aud.confirmed_with_cinema,
        is_demo=aud.is_demo,
    )


@router.get("/{auditorium_id}/layout")
async def get_auditorium_layout(auditorium_id: int, db: AsyncSession = Depends(get_db)):
    aud = await db.get(Auditorium, auditorium_id)
    if not aud:
        raise HTTPException(status_code=404, detail="Auditorium not found")

    # Fetch seats from database
    stmt = select(Seat).where(Seat.auditorium_id == auditorium_id).order_by(Seat.seat_id)
    result = await db.execute(stmt)
    seats = result.scalars().all()

    if not seats:
        # Fallback to local seat_layout_v2.json if available
        layout_path = Path("frontend/public/models/seat_layout_v2.json")
        if layout_path.exists():
            with open(layout_path, "r", encoding="utf-8") as f:
                return json.load(f)

    seats_data = []
    for s in seats:
        seats_data.append({
            "seat_id": s.seat_id,
            "row": s.row,
            "number": s.number,
            "category": s.category,
            "node_name": s.node_name,
            "eye_position": [s.eye_x, s.eye_y, s.eye_z],
            "distance_to_screen": s.distance_to_screen,
            "vertical_angle_deg": s.vertical_angle_deg,
            "horizontal_angle_deg": s.horizontal_angle_deg,
            "is_accessible": bool(s.is_accessible),
            "is_companion": bool(getattr(s, "is_companion", False))
        })

    return {
        "auditorium_id": aud.id,
        "name": aud.name,
        "screen_type": aud.screen_type,
        "total_seats": len(seats_data),
        "glb_path": "/models/cineverse_auditorium_v2.web.glb",
        "seats": seats_data
    }


@router.get("/{auditorium_id}/obstructions")
async def get_auditorium_obstructions(auditorium_id: int, db: AsyncSession = Depends(get_db)):
    """Returns static geometric view obstruction estimates per seat against theatre colliders."""
    aud = await db.get(Auditorium, auditorium_id)
    if not aud:
        raise HTTPException(status_code=404, detail="Auditorium not found")

    obstruction_path = Path("frontend/public/models/seat_obstructions.json")
    if not obstruction_path.exists():
        obstruction_path = Path("../frontend/public/models/seat_obstructions.json")

    if not obstruction_path.exists():
        # Fallback or run computation
        from tools.compute_seat_obstructions import main as compute_obstructions
        compute_obstructions()

    with open(obstruction_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Ensure required disclaimer is present
    data["disclaimer"] = "Geometric raycast estimate against static theatre geometry only. No audience members or physical heads modelled."
    return data


