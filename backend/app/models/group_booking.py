import enum
import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class GroupBookingStatusEnum(str, enum.Enum):
    FORMATION = "FORMATION"
    HELD = "HELD"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class GroupTimeoutPolicyEnum(str, enum.Enum):
    HOST_COVERS = "HOST_COVERS"
    AUTO_REFUND = "AUTO_REFUND"


class GroupMemberRoleEnum(str, enum.Enum):
    HOST = "HOST"
    MEMBER = "MEMBER"


class MemberPaymentStatusEnum(str, enum.Enum):
    UNPAID = "UNPAID"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAID = "PAID"
    REFUNDED = "REFUNDED"


class GroupBooking(Base):
    __tablename__ = "group_bookings"

    id = Column(Integer, primary_key=True, index=True)
    group_code = Column(String(32), unique=True, index=True, nullable=False)
    showtime_id = Column(Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False, index=True)
    host_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(GroupBookingStatusEnum), default=GroupBookingStatusEnum.FORMATION, nullable=False, index=True)
    timeout_policy = Column(Enum(GroupTimeoutPolicyEnum), default=GroupTimeoutPolicyEnum.AUTO_REFUND, nullable=False)

    invite_token = Column(String(64), unique=True, index=True, nullable=False)
    invite_token_expires_at = Column(DateTime, nullable=False)
    is_invite_revoked = Column(Boolean, default=False)
    max_members = Column(Integer, default=8)

    hold_id = Column(String(100), nullable=True, index=True)
    hold_expires_at = Column(DateTime, nullable=True, index=True)
    hold_extended_count = Column(Integer, default=0)

    total_ticket_amount = Column(Float, default=0.0)
    convenience_fee = Column(Float, default=0.0)
    gst_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)

    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    showtime = relationship("Showtime")
    host_user = relationship("User", foreign_keys=[host_user_id])
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    booking = relationship("Booking")
    notifications = relationship("GroupNotification", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_members_group_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(GroupMemberRoleEnum), default=GroupMemberRoleEnum.MEMBER, nullable=False)
    color = Column(String(20), default="#E50914")
    initials = Column(String(5), default="U")

    proposed_seats = Column(JSON, default=list)   # e.g. ["E05"]
    assigned_seats = Column(JSON, default=list)   # finalized seats: ["E05"]
    share_amount = Column(Float, default=0.0)
    payment_status = Column(Enum(MemberPaymentStatusEnum), default=MemberPaymentStatusEnum.UNPAID, nullable=False, index=True)

    razorpay_order_id = Column(String(100), nullable=True, index=True)
    razorpay_payment_id = Column(String(100), nullable=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True)

    joined_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

    group = relationship("GroupBooking", back_populates="members")
    user = relationship("User")
    ticket = relationship("Ticket")


class GroupNotification(Base):
    __tablename__ = "group_notifications"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # INVITE, JOIN, PROPOSE, FINALIZED, PAID, TIMEOUT, REFUNDED
    title = Column(String(200), nullable=False)
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("GroupBooking", back_populates="notifications")
    user = relationship("User")
