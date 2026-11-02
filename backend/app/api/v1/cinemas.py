from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.cinema import Cinema, Auditorium
from app.schemas.cinema import CinemaResponse, CinemaDetailResponse

router = APIRouter()


@router.get("/", response_model=List[CinemaResponse])
async def list_cinemas(city_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Cinema)
    if city_id:
        stmt = stmt.where(Cinema.city_id == city_id)
    stmt = stmt.order_by(Cinema.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{id_or_slug}", response_model=CinemaDetailResponse)
async def get_cinema(id_or_slug: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Cinema).options(selectinload(Cinema.auditoriums))
    if id_or_slug.isdigit():
        stmt = stmt.where(Cinema.id == int(id_or_slug))
    else:
        stmt = stmt.where(Cinema.slug == id_or_slug)

    result = await db.execute(stmt)
    cinema = result.scalars().first()
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")

    return cinema

