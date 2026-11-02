from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Date, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True, nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    synopsis = Column(Text, nullable=False)
    poster_url = Column(String(500), nullable=False)
    banner_url = Column(String(500), nullable=False)
    trailer_url = Column(String(500), nullable=True)
    duration_minutes = Column(Integer, default=150)
    certificate = Column(String(10), default="UA")  # U, UA, A
    release_date = Column(Date, default=date.today)
    is_now_showing = Column(Boolean, default=True, index=True)
    is_coming_soon = Column(Boolean, default=False, index=True)
    rating_avg = Column(Float, default=8.8)
    rating_count = Column(Integer, default=1250)
    interested_count = Column(Integer, default=4500)
    languages = Column(JSON, default=list)  # ["Hindi", "English", "Kannada"]
    genres = Column(JSON, default=list)     # ["Action", "Sci-Fi", "Drama"]
    formats = Column(JSON, default=list)    # ["2D", "3D", "IMAX 3D", "4DX"]
    created_at = Column(DateTime, default=datetime.utcnow)

    cast_members = relationship("MovieCast", back_populates="movie", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="movie")
    showtimes = relationship("Showtime", back_populates="movie")


class MovieCast(Base):
    __tablename__ = "movie_cast"

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    person_name = Column(String(200), nullable=False)
    role_name = Column(String(200), nullable=False)  # Character name or "Director"
    photo_url = Column(String(500), nullable=True)
    category = Column(String(50), default="Cast")    # "Cast", "Director", "Music"

    movie = relationship("Movie", back_populates="cast_members")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1 to 10
    headline = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    has_spoilers = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    movie = relationship("Movie", back_populates="reviews")
    user = relationship("User", back_populates="reviews")


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

