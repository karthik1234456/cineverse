import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class WaitlistStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    NOTIFIED = "NOTIFIED"
    CLAIMED = "CLAIMED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"
    __table_args__ = (
        Index("ix_waitlist_showtime_status_created", "showtime_id", "status", "created_at"),
        Index("ix_waitlist_user_status", "user_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    showtime_id = Column(Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False, index=True)
    desired_seats_count = Column(Integer, default=2, nullable=False)
    category = Column(String(50), nullable=True)  # "Front", "Prime", "Premier" or None
    status = Column(Enum(WaitlistStatusEnum), default=WaitlistStatusEnum.ACTIVE, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notified_at = Column(DateTime, nullable=True)
    claim_window_expires_at = Column(DateTime, nullable=True)

    user = relationship("User", backref="waitlist_entries")
    showtime = relationship("Showtime", backref="waitlist_entries")

