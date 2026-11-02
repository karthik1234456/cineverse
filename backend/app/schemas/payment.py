from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.models.payment import PaymentStatusEnum


class RazorpayOrderCreateRequest(BaseModel):
    booking_id: int


class RazorpayOrderResponse(BaseModel):
    order_id: str
    booking_id: int
    amount: float
    currency: str = "INR"
    key_id: str
    name: str = "CineVerse India"
    description: str = "Movie Ticket Booking"


class PaymentVerifyRequest(BaseModel):
    booking_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentResponse(BaseModel):
    id: int
    booking_id: int
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    amount: float
    status: PaymentStatusEnum

    class Config:
        from_attributes = True


class CouponValidateRequest(BaseModel):
    code: str
    order_amount: float


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_amount: float
    message: str

