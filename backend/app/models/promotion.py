import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Boolean
from app.database import Base


class DiscountTypeEnum(str, enum.Enum):
    PERCENTAGE = "PERCENTAGE"
    FLAT = "FLAT"


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=False)
    discount_type = Column(Enum(DiscountTypeEnum), default=DiscountTypeEnum.PERCENTAGE, nullable=False)
    discount_value = Column(Float, nullable=False)  # e.g., 20 (for 20%) or 100 (for ₹100 flat)
    min_order_amount = Column(Float, default=0.0)
    max_discount_amount = Column(Float, default=150.0)
    valid_until = Column(DateTime, nullable=True)
    usage_limit_per_user = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)


class CouponRedemption(Base):
    __tablename__ = "coupon_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    discount_amount = Column(Float, nullable=False)
    redeemed_at = Column(DateTime, default=datetime.utcnow)

