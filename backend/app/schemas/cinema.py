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
    screen_format_id: Optional[int] = None
    sound_system_id: Optional[int] = None
    projection_type_id: Optional[int] = None
    screen_format_name: Optional[str] = None
    sound_system_name: Optional[str] = None
    projection_type_name: Optional[str] = None
    tech_specs_display: Optional[str] = None
    requires_glasses: bool = False
    confirmed_with_cinema: bool = False
    is_demo: bool = True

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
    pincode: Optional[str] = None
    landmark: Optional[str] = None
    parking: Optional[str] = "Covered"
    transit_stop: Optional[str] = None
    phone: Optional[str] = "+91 80 4000 1234"
    opening_hours: Optional[str] = "09:00 AM - 11:30 PM"
    is_demo_data: bool = True
    distance_km: Optional[float] = None
    directions_url: Optional[str] = None

    class Config:
        from_attributes = True


class CinemaCoordinatesUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    pincode: Optional[str] = None
    landmark: Optional[str] = None
    parking: Optional[str] = None
    transit_stop: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None


class CinemaDetailResponse(CinemaResponse):
    auditoriums: List[AuditoriumResponse] = []

