from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel


class AdminAnalyticsResponse(BaseModel):
    total_revenue: float
    total_bookings: int
    total_tickets_sold: int
    overall_occupancy_percentage: float
    top_movies: List[Dict[str, Any]]
    top_cinemas: List[Dict[str, Any]]
    recent_bookings: List[Dict[str, Any]]


class ShowtimeCreateRequest(BaseModel):
    movie_id: int
    cinema_id: int
    auditorium_id: int
    start_time: datetime
    end_time: datetime
    format: str = "IMAX 3D"
    language: str = "English"
    price_front: float = 280.0
    price_prime: float = 380.0
    price_premier: float = 520.0

