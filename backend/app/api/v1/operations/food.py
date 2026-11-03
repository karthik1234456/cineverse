from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.auth import User
from app.models.booking import Booking
from app.models.showtime import Showtime
from app.models.operations import FoodOrder, FoodDeliveryTypeEnum, FoodDeliveryStatusEnum
from app.api.dependencies import require_user, require_cinema_manager

router = APIRouter(prefix="/api/v1/food", tags=["At-Seat Food & Drink Orders"])


class FoodOrderItem(BaseModel):
    name: str
    quantity: int = 1
    price: float


class FoodOrderCreateRequest(BaseModel):
    booking_id: int
    delivery_type: FoodDeliveryTypeEnum = FoodDeliveryTypeEnum.SEAT_DELIVERY
    target_row: Optional[str] = None
    target_seat: Optional[str] = None
    items: List[FoodOrderItem]


class FoodStatusUpdateRequest(BaseModel):
    status: FoodDeliveryStatusEnum


@router.post("/order")
async def create_food_order(
    req: FoodOrderCreateRequest,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates an at-seat or counter-pickup concessions order for a confirmed booking."""
    booking = await db.get(Booking, req.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this booking")

    showtime = await db.get(Showtime, booking.showtime_id)
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    # Cutoff check: orders accepted up to 15 minutes after showtime start
    cutoff_time = showtime.start_time + timedelta(minutes=15)
    if datetime.utcnow() > cutoff_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Concession order cutoff exceeded. In-seat ordering closed for this showtime."
        )

    if not req.items:
        raise HTTPException(status_code=400, detail="Cannot place empty food order")

    total_amount = sum(item.price * item.quantity for item in req.items)

    order = FoodOrder(
        booking_id=booking.id,
        showtime_id=showtime.id,
        cinema_id=showtime.cinema_id,
        auditorium_id=showtime.auditorium_id,
        delivery_type=req.delivery_type,
        delivery_status=FoodDeliveryStatusEnum.PREPARING,
        target_row=req.target_row,
        target_seat=req.target_seat,
        items=[item.dict() for item in req.items],
        total_amount=round(total_amount, 2),
        order_cutoff_time=cutoff_time
    )
    db.add(order)
    await db.commit()

    return {
        "status": "success",
        "order_id": order.id,
        "delivery_type": order.delivery_type,
        "delivery_status": order.delivery_status,
        "target_seat": order.target_seat,
        "total_amount": order.total_amount
    }


@router.get("/kds/orders")
async def list_kitchen_display_orders(
    cinema_id: Optional[int] = None,
    auditorium_id: Optional[int] = None,
    status_filter: Optional[FoodDeliveryStatusEnum] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Kitchen Display System (KDS) View for concessions staff.
    Displays preparation queue stripped of customer PII (only seat, row, items).
    """
    stmt = select(FoodOrder).order_by(FoodOrder.created_at.asc())
    if cinema_id:
        stmt = stmt.where(FoodOrder.cinema_id == cinema_id)
    if auditorium_id:
        stmt = stmt.where(FoodOrder.auditorium_id == auditorium_id)
    if status_filter:
        stmt = stmt.where(FoodOrder.delivery_status == status_filter)
    else:
        # Default: omit DELIVERED and CANCELLED
        stmt = stmt.where(FoodOrder.delivery_status.in_([FoodDeliveryStatusEnum.PREPARING, FoodDeliveryStatusEnum.READY]))

    res = await db.execute(stmt)
    orders = res.scalars().all()

    return {
        "count": len(orders),
        "orders": [
            {
                "order_id": o.id,
                "booking_id": o.booking_id,
                "delivery_type": o.delivery_type,
                "delivery_status": o.delivery_status,
                "target_row": o.target_row,
                "target_seat": o.target_seat,
                "items": o.items,
                "created_at": o.created_at.isoformat() if o.created_at else None
            }
            for o in orders
        ]
    }


@router.patch("/kds/orders/{order_id}/status")
async def update_kitchen_order_status(
    order_id: int,
    req: FoodStatusUpdateRequest,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Transitions kitchen order status: PREPARING -> READY -> DELIVERED."""
    order = await db.get(FoodOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.delivery_status = req.status
    order.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "order_id": order.id,
        "delivery_status": order.delivery_status,
        "updated_at": order.updated_at.isoformat()
    }
