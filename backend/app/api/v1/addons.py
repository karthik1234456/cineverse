from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.booking import FnbItem
from app.schemas.booking import FnbItemResponse

router = APIRouter()


@router.get("/", response_model=List[FnbItemResponse])
async def list_addons(cinema_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(FnbItem).where(FnbItem.is_available == True)
    if cinema_id:
        stmt = stmt.where((FnbItem.cinema_id == cinema_id) | (FnbItem.cinema_id == None))
    result = await db.execute(stmt)
    return result.scalars().all()

