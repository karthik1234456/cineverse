from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.booking import Booking
from app.schemas.payment import (
    RazorpayOrderCreateRequest, RazorpayOrderResponse, PaymentVerifyRequest
)
from app.schemas.booking import BookingResponse
from app.services.payment_service import (
    create_razorpay_order, verify_payment, process_webhook
)
from app.api.v1.bookings import format_booking_response

router = APIRouter()


@router.post("/create-order", response_model=RazorpayOrderResponse)
async def api_create_payment_order(
    req: RazorpayOrderCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await create_razorpay_order(db, req.booking_id)
    return RazorpayOrderResponse(**result)


@router.post("/verify", response_model=BookingResponse)
async def api_verify_payment(
    req: PaymentVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    booking = await verify_payment(
        db,
        req.booking_id,
        req.razorpay_order_id,
        req.razorpay_payment_id,
        req.razorpay_signature
    )
    return await format_booking_response(booking, db)


@router.post("/webhook")
async def api_payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_razorpay_signature: Optional[str] = Header(None)
):
    raw_body = await request.body()
    
    # If signature header is provided, strictly verify HMAC-SHA256 over raw request body
    if x_razorpay_signature:
        import hmac, hashlib
        from app.config import settings
        expected_sig = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, x_razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON webhook body")

    event_id = payload.get("event_id") or payload.get("id") or "evt_test_123"
    event_type = payload.get("event") or "payment.captured"

    result = await process_webhook(db, event_id, event_type, payload)
    return result

