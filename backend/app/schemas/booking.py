from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.booking import BookingStatusEnum


class SeatHoldRequest(BaseModel):
    seat_ids: List[str]
    idempotency_key: Optional[str] = None


class SeatHoldResponse(BaseModel):
    hold_id: str
    showtime_id: int
    held_seats: List[str]
    expires_at: datetime
    hold_duration_seconds: int
    is_extended: bool = False
    message: str = "Seats held successfully"


class SeatReleaseRequest(BaseModel):
    hold_id: str
    seat_ids: Optional[List[str]] = None


class SeatExtendRequest(BaseModel):
    hold_id: str


class AddonOrder(BaseModel):
    fnb_item_id: int
    quantity: int


class HoldSeatQuote(BaseModel):
    seat_id: str
    category: str
    price: float
    price_display: str


class HoldAddonQuote(BaseModel):
    fnb_item_id: int
    name: str
    quantity: int
    unit_price: float
    unit_price_display: str
    line_total: float
    line_total_display: str


class HoldCouponQuote(BaseModel):
    code: str
    discount_amount: float
    discount_amount_display: str
    message: Optional[str] = None


class HoldQuoteResponse(BaseModel):
    hold_id: str
    showtime_id: int
    movie_id: Optional[int] = None
    movie_title: str
    movie_poster_url: str
    movie_banner_url: Optional[str] = None
    movie_dominant_color: Optional[str] = None
    movie_glimpse_url: Optional[str] = None
    movie_glimpse_webm_url: Optional[str] = None
    movie_glimpse_720p_url: Optional[str] = None
    cinema_name: str
    cinema_address: str
    cinema_latitude: Optional[float] = None
    cinema_longitude: Optional[float] = None
    cinema_pincode: Optional[str] = None
    cinema_landmark: Optional[str] = None
    cinema_parking: Optional[str] = None
    cinema_transit_stop: Optional[str] = None
    directions_url: Optional[str] = None
    auditorium_name: str
    screen_type: str
    screen_format: Optional[str] = None
    sound_system: Optional[str] = None
    projection_type: Optional[str] = None
    tech_specs_display: Optional[str] = None
    requires_glasses: bool = False
    confirmed_with_cinema: bool = False
    is_demo: bool = True
    start_time: datetime
    expires_at: datetime
    hold_duration_seconds: int
    held_seats: List[HoldSeatQuote]
    ticket_subtotal: float
    ticket_subtotal_display: str
    convenience_fee: float
    convenience_fee_display: str
    gst_amount: float
    gst_amount_display: str
    addons: List[HoldAddonQuote] = []
    addons_subtotal: float = 0.0
    addons_subtotal_display: str = "₹0"
    applied_coupon: Optional[HoldCouponQuote] = None
    discount_amount: float = 0.0
    discount_amount_display: str = "₹0"
    final_total: float
    final_total_display: str
    price_lock_guarantee: str = "The price shown at checkout is final"


class HoldAddonsUpdateRequest(BaseModel):
    addons: List[AddonOrder] = []


class HoldCouponApplyRequest(BaseModel):
    code: str


class BookingCreateRequest(BaseModel):
    hold_id: str
    contact_email: EmailStr
    contact_phone: str
    showtime_id: Optional[int] = None
    seat_ids: Optional[List[str]] = None
    addons: Optional[List[AddonOrder]] = None
    coupon_code: Optional[str] = None


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
    movie_id: Optional[int] = None
    movie_title: str
    movie_poster_url: str
    movie_banner_url: Optional[str] = None
    movie_dominant_color: Optional[str] = None
    movie_glimpse_url: Optional[str] = None
    movie_glimpse_webm_url: Optional[str] = None
    movie_glimpse_720p_url: Optional[str] = None
    cinema_name: str
    cinema_address: str
    cinema_latitude: Optional[float] = None
    cinema_longitude: Optional[float] = None
    cinema_pincode: Optional[str] = None
    cinema_landmark: Optional[str] = None
    cinema_parking: Optional[str] = None
    cinema_transit_stop: Optional[str] = None
    directions_url: Optional[str] = None
    auditorium_name: str
    screen_type: str
    screen_format: Optional[str] = None
    sound_system: Optional[str] = None
    projection_type: Optional[str] = None
    tech_specs_display: Optional[str] = None
    requires_glasses: bool = False
    confirmed_with_cinema: bool = False
    is_demo: bool = True
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

