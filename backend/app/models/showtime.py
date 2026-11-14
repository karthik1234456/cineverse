import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.database import Base


class SeatStatusEnum(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    HELD = "HELD"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    BOOKED = "BOOKED"


class Showtime(Base):
    __tablename__ = "showtimes"
    __table_args__ = (
        Index("ix_showtimes_cinema_movie_date", "cinema_id", "movie_id", "start_time"),
        Index("ix_showtimes_auditorium_start", "auditorium_id", "start_time"),
    )

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id", ondelete="CASCADE"), nullable=False, index=True)
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False)
    format = Column(String(50), default="IMAX 3D", index=True)
    language = Column(String(50), default="English")
    cancellation_cutoff_minutes = Column(Integer, default=120)

    movie = relationship("Movie", back_populates="showtimes")
    auditorium = relationship("Auditorium", back_populates="showtimes")
    cinema = relationship("Cinema", back_populates="showtimes")
    price_rules = relationship("PriceRule", back_populates="showtime", cascade="all, delete-orphan")
    seat_inventory = relationship("SeatInventory", back_populates="showtime", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="showtime")


class PriceRule(Base):
    __tablename__ = "price_rules"

    id = Column(Integer, primary_key=True, index=True)
    showtime_id = Column(Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # "Front", "Prime", "Premier"
    base_price = Column(Float, nullable=False)     # e.g., 280.0, 380.0, 520.0

    showtime = relationship("Showtime", back_populates="price_rules")


class SeatInventory(Base):
    __tablename__ = "seat_inventory"
    __table_args__ = (
        UniqueConstraint("showtime_id", "seat_id", name="uq_showtime_seat"),
        Index("ix_seat_inventory_showtime_status", "showtime_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    showtime_id = Column(Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id = Column(String(10), nullable=False, index=True)  # "A01"
    category = Column(String(50), nullable=False)
    price = Column(Float, nullable=False)
    status = Column(Enum(SeatStatusEnum), default=SeatStatusEnum.AVAILABLE, nullable=False, index=True)
    hold_id = Column(String(100), nullable=True, index=True)
    hold_expires_at = Column(DateTime, nullable=True, index=True)
    held_by_user_id = Column(Integer, nullable=True)
    booking_id = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    showtime = relationship("Showtime", back_populates="seat_inventory")

