from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.booking import BookingStatusEnum


class SeatHoldRequest(BaseModel):
    seat_ids: List[str]


class SeatHoldResponse(BaseModel):
    hold_id: str
    showtime_id: int
    held_seats: List[str]
    expires_at: datetime
    hold_duration_seconds: int
    message: str = "Seats held successfully"


class SeatReleaseRequest(BaseModel):
    hold_id: str
    seat_ids: Optional[List[str]] = None


class SeatExtendRequest(BaseModel):
    hold_id: str


class AddonOrder(BaseModel):
    fnb_item_id: int
    quantity: int


class BookingCreateRequest(BaseModel):
    showtime_id: int
    hold_id: str
    seat_ids: List[str]
    addons: List[AddonOrder] = []
    coupon_code: Optional[str] = None
    contact_email: EmailStr
    contact_phone: str


class FnbItemResponse(BaseModel):
    id: int
    name: str
    description: str
    category: str
    price: float
    image_url: Optional[str] = None
    is_available: bool

    class Config:
        from_attributes = True


class BookingSeatResponse(BaseModel):
    seat_id: str
    category: str
    price: float

    class Config:
        from_attributes = True


class BookingAddonResponse(BaseModel):
    fnb_item_id: int
    name: str
    quantity: int
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    ticket_number: str
    qr_data: str
    qr_code_url: Optional[str] = None
    hmac_signature: str
    issued_at: datetime

    class Config:
        from_attributes = True


class BookingResponse(BaseModel):
    id: int
    booking_code: str
    showtime_id: int
    movie_title: str
    movie_poster_url: str
    cinema_name: str
    cinema_address: str
    auditorium_name: str
    screen_type: str
    start_time: datetime
    seats: List[BookingSeatResponse]
    addons: List[BookingAddonResponse]
    total_ticket_amount: float
    convenience_fee: float
    gst_amount: float
    addons_amount: float
    discount_amount: float
    final_total_amount: float
    status: BookingStatusEnum
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: datetime
    ticket: Optional[TicketResponse] = None

    class Config:
        from_attributes = True

