from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.cinema import Auditorium, Cinema, City
from app.models.showtime import Showtime
from app.models.technical_specs import ScreenFormat, SoundSystem, ProjectionType
from app.schemas.technical_specs import (
    ScreenFormatResponse,
    SoundSystemResponse,
    ProjectionTypeResponse,
)

router = APIRouter()


@router.get("/formats", response_model=List[ScreenFormatResponse])
async def list_screen_formats(db: AsyncSession = Depends(get_db)):
    """List all active screen formats."""
    stmt = select(ScreenFormat).where(ScreenFormat.is_active == True).order_by(ScreenFormat.name)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/sounds", response_model=List[SoundSystemResponse])
async def list_sound_systems(db: AsyncSession = Depends(get_db)):
    """List all active sound systems."""
    stmt = select(SoundSystem).where(SoundSystem.is_active == True).order_by(SoundSystem.name)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/projections", response_model=List[ProjectionTypeResponse])
async def list_projection_types(db: AsyncSession = Depends(get_db)):
    """List all active projection types."""
    stmt = select(ProjectionType).where(ProjectionType.is_active == True).order_by(ProjectionType.name)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/facets")
async def get_filter_facets(
    city_id: Optional[int] = Query(None, description="Optional city ID filter"),
    movie_id: Optional[int] = Query(None, description="Optional movie ID filter"),
    cinema_id: Optional[int] = Query(None, description="Optional cinema ID filter"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns available screen formats, sound systems, and projection types with auditorium/showtime counts,
    strictly scoped to the selected city or movie. No city will return formats it has no halls for.
    """
    # Base query for auditoriums joined with cinema and city
    aud_query = (
        select(Auditorium)
        .join(Cinema, Cinema.id == Auditorium.cinema_id)
        .options(
            selectinload(Auditorium.screen_format),
            selectinload(Auditorium.sound_system),
            selectinload(Auditorium.projection_type)
        )
    )
    if cinema_id:
        aud_query = aud_query.where(Auditorium.cinema_id == cinema_id)
    elif city_id:
        aud_query = aud_query.where(Cinema.city_id == city_id)

    if movie_id:
        # If movie_id is provided, only include auditoriums currently showing this movie
        aud_query = aud_query.join(Showtime, Showtime.auditorium_id == Auditorium.id).where(Showtime.movie_id == movie_id)

    res = await db.execute(aud_query)
    auditoriums = res.scalars().unique().all()

    format_counts: Dict[str, Dict[str, Any]] = {}
    sound_counts: Dict[str, Dict[str, Any]] = {}
    projection_counts: Dict[str, Dict[str, Any]] = {}

    for aud in auditoriums:
        fmt = aud.screen_format
        fmt_name = fmt.name if fmt else aud.screen_type
        if fmt_name:
            if fmt_name not in format_counts:
                format_counts[fmt_name] = {
                    "name": fmt_name,
                    "count": 0,
                    "requires_glasses": fmt.requires_glasses if fmt else ("3D" in fmt_name)
                }
            format_counts[fmt_name]["count"] += 1

        snd = aud.sound_system
        snd_name = snd.name if snd else "Standard 5.1"
        if snd_name:
            if snd_name not in sound_counts:
                sound_counts[snd_name] = {
                    "name": snd_name,
                    "count": 0,
                    "channels": snd.channels if snd else "5.1"
                }
            sound_counts[snd_name]["count"] += 1

        prj = aud.projection_type
        prj_name = prj.name if prj else "Standard digital"
        if prj_name:
            if prj_name not in projection_counts:
                projection_counts[prj_name] = {
                    "name": prj_name,
                    "count": 0,
                    "resolution": prj.resolution if prj else "2K Digital"
                }
            projection_counts[prj_name]["count"] += 1

    return {
        "city_id": city_id,
        "movie_id": movie_id,
        "cinema_id": cinema_id,
        "total_auditoriums": len(auditoriums),
        "formats": sorted(list(format_counts.values()), key=lambda x: (-x["count"], x["name"])),
        "sounds": sorted(list(sound_counts.values()), key=lambda x: (-x["count"], x["name"])),
        "projections": sorted(list(projection_counts.values()), key=lambda x: (-x["count"], x["name"])),
    }
