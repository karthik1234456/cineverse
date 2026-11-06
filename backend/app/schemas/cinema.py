from typing import List, Optional
from pydantic import BaseModel


class SeatResponse(BaseModel):
    id: int
    seat_id: str
    row: str
    number: int
    category: str
    node_name: str
    eye_x: float
    eye_y: float
    eye_z: float
    distance_to_screen: float
    vertical_angle_deg: float
    horizontal_angle_deg: float
    is_accessible: bool = False

    class Config:
        from_attributes = True


class AuditoriumResponse(BaseModel):
    id: int
    cinema_id: int
    name: str
    screen_type: str
    total_seats: int
    has_3d_preview: bool
    layout_data: Optional[dict] = None
    glb_path: Optional[str] = "/models/cineverse_auditorium_v2.web.glb"
    layout_path: Optional[str] = "/models/seat_layout_v2.json"

    class Config:
        from_attributes = True


class CinemaResponse(BaseModel):
    id: int
    city_id: int
    name: str
    slug: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    cancellation_policy: str
    facilities: List[str]
    images: List[str]

    class Config:
        from_attributes = True


class CinemaDetailResponse(CinemaResponse):
    auditoriums: List[AuditoriumResponse] = []

