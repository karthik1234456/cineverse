from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.cinema import City
from app.schemas.city import CityResponse

router = APIRouter()


@router.get("/", response_model=List[CityResponse])
async def list_cities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(City).where(City.is_active == True).order_by(City.name))
    return result.scalars().all()

