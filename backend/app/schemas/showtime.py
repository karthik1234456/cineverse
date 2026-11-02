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


class SeatInventoryItem(BaseModel):
    seat_id: str
    category: str
    price: float
    status: SeatStatusEnum
    held_by_current_user: bool = False
    row: str
    number: int
    node_name: str
    distance_to_screen: float
    vertical_angle_deg: float
    horizontal_angle_deg: float


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
    format: str
    language: str
    start_time: datetime
    glb_path: str = "/models/cineverse_auditorium_v2.web.glb"
    layout_path: str = "/models/seat_layout_v2.json"
    seats: List[SeatInventoryItem]

