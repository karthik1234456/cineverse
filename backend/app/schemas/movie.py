from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel


class CastMemberResponse(BaseModel):
    id: int
    person_name: str
    role_name: str
    photo_url: Optional[str] = None
    category: str

    class Config:
        from_attributes = True


class ReviewCreate(BaseModel):
    movie_id: int
    rating: int  # 1 to 10
    headline: str
    content: str
    has_spoilers: bool = False


class ReviewResponse(BaseModel):
    id: int
    movie_id: int
    user_id: int
    rating: int
    headline: str
    content: str
    has_spoilers: bool
    created_at: datetime
    user_name: Optional[str] = "Verified Viewer"

    class Config:
        from_attributes = True


class MovieResponse(BaseModel):
    id: int
    title: str
    slug: str
    synopsis: str
    poster_url: str
    banner_url: str
    trailer_url: Optional[str] = None
    trailer_duration_seconds: Optional[int] = 25
    trailer_poster_frame_url: Optional[str] = None
    trailer_captions_url: Optional[str] = None
    dominant_color: Optional[str] = None
    glimpse_url: Optional[str] = None
    glimpse_webm_url: Optional[str] = None
    glimpse_720p_url: Optional[str] = None
    duration_minutes: int
    certificate: str
    release_date: date
    is_now_showing: bool
    is_coming_soon: bool
    rating_avg: float
    rating_count: int
    interested_count: int
    languages: List[str]
    genres: List[str]
    formats: List[str]
    tmdb_id: Optional[int] = None
    tmdb_vote_average: Optional[float] = None
    tmdb_popularity: Optional[float] = None
    is_tmdb: Optional[bool] = False
    youtube_trailer_id: Optional[str] = None

    class Config:
        from_attributes = True


class MovieDetailResponse(MovieResponse):
    cast_members: List[CastMemberResponse] = []
    reviews: List[ReviewResponse] = []

