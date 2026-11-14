from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.showtime import SeatStatusEnum


class PriceRuleResponse(BaseModel):
    category: str
    base_price: float

    class Config:
        from_attributes = True


class ShowtimeResponse(BaseModel):
    id: int
    movie_id: int
    auditorium_id: int
    cinema_id: int
    start_time: datetime
    end_time: datetime
    format: str
    language: str
    cancellation_cutoff_minutes: int
    cinema_name: Optional[str] = None
    auditorium_name: Optional[str] = None
    has_3d_preview: Optional[bool] = True
    lowest_price: Optional[float] = 280.0
    availability_status: Optional[str] = "AVAILABLE"  # AVAILABLE, FAST_FILLING, ALMOST_FULL, SOLD_OUT

    class Config:
        from_attributes = True


class TierSummaryItem(BaseModel):
    name: str              # e.g. "Front", "Prime", "Premier"
    category: str          # e.g. "front", "prime", "premier"
    price: float           # e.g. 280.0
    currency: str = "INR"
    rows: List[str]        # e.g. ["A", "B", "C"]
    color: Optional[str] = None


class SeatInventoryItem(BaseModel):
    seat_id: str
    category: str
    price: float
    currency: str = "INR"
    quote_id: Optional[str] = None
    status: SeatStatusEnum
    held_by_current_user: bool = False
    row: str
    number: int
    node_name: str
    distance_to_screen: float
    vertical_angle_deg: float
    horizontal_angle_deg: float
    is_accessible: bool = False
    is_companion: bool = False
    seat_type: Optional[str] = None
    pod_id: Optional[str] = None
    motion_zone: Optional[str] = None


class ShowtimeSeatsResponse(BaseModel):
    showtime_id: int
    movie_id: int
    movie_title: str
    cinema_id: int
    cinema_name: str
    auditorium_id: int
    auditorium_name: str
    screen_type: str
    has_3d_preview: bool
    layout_data: Optional[dict] = None
    layout_signature: Optional[str] = None
    format: str
    screen_format: Optional[str] = None
    sound_system: Optional[str] = None
    projection_type: Optional[str] = None
    tech_specs_display: Optional[str] = None
    requires_glasses: bool = False
    confirmed_with_cinema: bool = False
    is_demo: bool = True
    language: str
    start_time: datetime
    currency: str = "INR"
    quote_id: Optional[str] = None
    glb_path: str = "/models/cineverse_auditorium_v2.web.glb"
    layout_path: str = "/models/seat_layout_v2.json"
    trailer_url: Optional[str] = None
    poster_url: Optional[str] = None
    banner_url: Optional[str] = None
    dominant_color: Optional[str] = None
    glimpse_url: Optional[str] = None
    glimpse_webm_url: Optional[str] = None
    glimpse_720p_url: Optional[str] = None
    tiers: List[TierSummaryItem] = []
    seats: List[SeatInventoryItem]

