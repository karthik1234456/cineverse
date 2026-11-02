from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.promotion import Coupon
from app.models.auth import User
from app.schemas.payment import CouponValidateRequest, CouponValidateResponse
from app.services.auth_service import get_current_user
from app.services.booking_service import validate_coupon

router = APIRouter()


@router.get("/active")
async def list_active_coupons(db: AsyncSession = Depends(get_db)):
    stmt = select(Coupon).where(Coupon.is_active == True)
    result = await db.execute(stmt)
    coupons = result.scalars().all()
    return [
        {
            "code": c.code,
            "description": c.description,
            "discount_type": c.discount_type.value,
            "discount_value": c.discount_value,
            "min_order_amount": c.min_order_amount,
            "max_discount_amount": c.max_discount_amount
        }
        for c in coupons
    ]


@router.post("/validate", response_model=CouponValidateResponse)
async def api_validate_coupon(
    req: CouponValidateRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    try:
        coupon, discount = await validate_coupon(db, req.code.upper().strip(), user_id, req.order_amount)
        return CouponValidateResponse(
            valid=True,
            code=coupon.code,
            discount_amount=discount,
            message=f"Coupon {coupon.code} applied! You save ₹{discount}"
        )
    except HTTPException as e:
        return CouponValidateResponse(
            valid=False,
            code=req.code,
            discount_amount=0.0,
            message=e.detail
        )
