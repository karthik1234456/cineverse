import enum
from datetime import datetime, timedelta
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Enum, ForeignKey,
    Boolean, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


# Enums
class FoodDeliveryTypeEnum(str, enum.Enum):
    COUNTER_PICKUP = "COUNTER_PICKUP"
    SEAT_DELIVERY = "SEAT_DELIVERY"


class FoodDeliveryStatusEnum(str, enum.Enum):
    PREPARING = "PREPARING"
    READY = "READY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class LoyaltyTierEnum(str, enum.Enum):
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"


class LoyaltyActionEnum(str, enum.Enum):
    EARN = "EARN"
    REDEEM = "REDEEM"
    BONUS = "BONUS"
    REFERRAL = "REFERRAL"
    EXPIRE = "EXPIRE"


class ScanResultEnum(str, enum.Enum):
    SUCCESS = "SUCCESS"
    ALREADY_USED = "ALREADY_USED"
    INVALID_HMAC = "INVALID_HMAC"
    SHOWTIME_MISMATCH = "SHOWTIME_MISMATCH"
    CANCELLED_BOOKING = "CANCELLED_BOOKING"
    OFFLINE_RESOLVED = "OFFLINE_RESOLVED"


# 1. Asset Versioning & Onboarding
class TheatreAssetVersion(Base):
    __tablename__ = "theatre_asset_versions"

    id = Column(Integer, primary_key=True, index=True)
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(50), nullable=False)  # e.g., "1.0", "1.1", "2.0"
    glb_path = Column(String(500), nullable=False)
    optimized_glb_path = Column(String(500), nullable=True)
    layout_data = Column(JSON, nullable=False)      # Seat layout JSON
    walk_nav_data = Column(JSON, nullable=False)    # Walk navigation JSON
    coordinate_convention = Column(String(50), default="glTF_Y_UP")
    total_triangles = Column(Integer, default=0)
    optimized_triangles = Column(Integer, default=0)
    file_size_bytes = Column(Integer, default=0)
    optimized_size_bytes = Column(Integer, default=0)
    validation_status = Column(String(50), default="VALID")  # VALID, WARNINGS, REJECTED
    validation_notes = Column(JSON, default=list)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    auditorium = relationship("Auditorium")


# 2. Staff Entry Scanning & Device Registry
class StaffDevice(Base):
    __tablename__ = "staff_devices"

    id = Column(Integer, primary_key=True, index=True)
    staff_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(String(100), unique=True, index=True, nullable=False)  # Device UUID
    device_name = Column(String(100), nullable=False)                         # e.g. "Gate 1 Scanner Android"
    assigned_gate = Column(String(50), default="Main Entrance")
    is_active = Column(Boolean, default=True)
    registered_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.utcnow)

    staff_user = relationship("User")


class TicketScanLog(Base):
    __tablename__ = "ticket_scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    staff_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    device_id = Column(String(100), nullable=True)
    gate = Column(String(50), default="Gate 1")
    scan_result = Column(Enum(ScanResultEnum), default=ScanResultEnum.SUCCESS, nullable=False, index=True)
    scanned_at = Column(DateTime, default=datetime.utcnow, index=True)
    offline_sync = Column(Boolean, default=False)
    scan_metadata = Column(JSON, default=dict)

    ticket = relationship("Ticket")


# 3. At-Seat Food & Drink Pre-Orders
class FoodOrder(Base):
    __tablename__ = "food_orders"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    showtime_id = Column(Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False, index=True)
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="CASCADE"), nullable=False, index=True)
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id", ondelete="CASCADE"), nullable=False, index=True)

    delivery_type = Column(Enum(FoodDeliveryTypeEnum), default=FoodDeliveryTypeEnum.SEAT_DELIVERY, nullable=False)
    delivery_status = Column(Enum(FoodDeliveryStatusEnum), default=FoodDeliveryStatusEnum.PREPARING, nullable=False, index=True)
    target_row = Column(String(5), nullable=True)       # e.g., "E"
    target_seat = Column(String(10), nullable=True)     # e.g., "E05"

    items = Column(JSON, nullable=False)                # [{"name": "Caramel Popcorn Large", "qty": 1, "price": 280.0}]
    total_amount = Column(Float, nullable=False)
    order_cutoff_time = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    booking = relationship("Booking")
    showtime = relationship("Showtime")
    cinema = relationship("Cinema")
    auditorium = relationship("Auditorium")


# 4. Loyalty, Points Ledger & CinePass
class LoyaltyAccount(Base):
    __tablename__ = "loyalty_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    points_balance = Column(Integer, default=0, nullable=False)
    tier = Column(Enum(LoyaltyTierEnum), default=LoyaltyTierEnum.SILVER, nullable=False)
    total_lifetime_points = Column(Integer, default=0)
    total_spent_inr = Column(Float, default=0.0)
    referral_code = Column(String(32), unique=True, index=True, nullable=False)
    referred_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    ledger_entries = relationship("LoyaltyLedger", back_populates="account", cascade="all, delete-orphan")


class LoyaltyLedger(Base):
    __tablename__ = "loyalty_ledger"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("loyalty_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    points_delta = Column(Integer, nullable=False)  # +100 or -50
    action = Column(Enum(LoyaltyActionEnum), nullable=False)
    description = Column(String(255), nullable=False)
    reference_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("LoyaltyAccount", back_populates="ledger_entries")


class CinePassSubscription(Base):
    __tablename__ = "cinepass_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_name = Column(String(50), default="CinePass Premium")
    monthly_price = Column(Float, default=799.0)
    monthly_ticket_quota = Column(Integer, default=4)
    tickets_used_this_period = Column(Integer, default=0)
    period_start = Column(DateTime, default=datetime.utcnow)
    period_end = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=30))
    is_active = Column(Boolean, default=True, index=True)
    auto_renew = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


# 5. Ticket Transfer Audit
class TicketTransferLog(Base):
    __tablename__ = "ticket_transfer_logs"

    id = Column(Integer, primary_key=True, index=True)
    original_ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    to_email = Column(String(255), nullable=False)
    new_ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True)
    transfer_status = Column(String(50), default="COMPLETED")
    transferred_at = Column(DateTime, default=datetime.utcnow)

    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
