import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class BookingStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class FnbItem(Base):
    __tablename__ = "fnb_items"

    id = Column(Integer, primary_key=True, index=True)
    cinema_id = Column(Integer, nullable=True)  # null = available everywhere
    name = Column(String(200), nullable=False)
    description = Column(String(500), nullable=False)
    category = Column(String(50), default="Combo")  # Popcorn, Beverage, Snack, Combo
    price = Column(Float, nullable=False)
    image_url = Column(String(500), nullable=True)
    is_available = Column(Boolean, default=True)


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(32), unique=True, index=True, nullable=False)  # e.g., "CV-892415"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    showtime_id = Column(Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(BookingStatusEnum), default=BookingStatusEnum.PENDING, nullable=False, index=True)
    total_ticket_amount = Column(Float, default=0.0)
    convenience_fee = Column(Float, default=0.0)
    gst_amount = Column(Float, default=0.0)
    addons_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    final_total_amount = Column(Float, default=0.0)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    showtime = relationship("Showtime", back_populates="bookings")
    seats = relationship("BookingSeat", back_populates="booking", cascade="all, delete-orphan")
    addons = relationship("BookingAddon", back_populates="booking", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="booking", uselist=False)
    ticket = relationship("Ticket", back_populates="booking", uselist=False)


class BookingSeat(Base):
    __tablename__ = "booking_seats"
    __table_args__ = (
        UniqueConstraint("showtime_id", "seat_id", name="uq_booking_seats_showtime_seat"),
    )

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    showtime_id = Column(Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id = Column(String(10), nullable=False)  # "A01"
    category = Column(String(50), nullable=False)
    price = Column(Float, nullable=False)

    booking = relationship("Booking", back_populates="seats")


class BookingAddon(Base):
    __tablename__ = "booking_addons"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    fnb_item_id = Column(Integer, ForeignKey("fnb_items.id"), nullable=False)
    name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    booking = relationship("Booking", back_populates="addons")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, nullable=False)
    ticket_number = Column(String(64), unique=True, index=True, nullable=False)
    qr_data = Column(String(1000), nullable=False)
    qr_code_url = Column(String(500), nullable=True)
    hmac_signature = Column(String(128), nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow)
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime, nullable=True)

    booking = relationship("Booking", back_populates="ticket")

