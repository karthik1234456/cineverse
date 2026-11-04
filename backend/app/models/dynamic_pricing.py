import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class PricingRuleStatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class DynamicPricingRule(Base):
    __tablename__ = "dynamic_pricing_rules"
    __table_args__ = (
        Index("ix_pricing_rules_status", "status"),
        Index("ix_pricing_rules_cinema_format", "cinema_id", "format"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="SET NULL"), nullable=True)
    format = Column(String(50), nullable=True)  # "IMAX 3D", "4DX", None = all
    min_occupancy_pct = Column(Float, default=0.0, nullable=False)
    max_occupancy_pct = Column(Float, default=100.0, nullable=False)
    hours_before_show_min = Column(Float, nullable=True)
    hours_before_show_max = Column(Float, nullable=True)
    day_type = Column(String(20), default="all", nullable=False)  # "weekday", "weekend", "all"
    price_multiplier = Column(Float, default=1.0, nullable=False)
    flat_adjustment = Column(Float, default=0.0, nullable=False)
    floor_price = Column(Float, nullable=False)  # Hard immutable floor
    ceiling_price = Column(Float, nullable=False)  # Hard immutable ceiling
    status = Column(Enum(PricingRuleStatusEnum), default=PricingRuleStatusEnum.DRAFT, nullable=False)
    created_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class PriceAuditLog(Base):
    __tablename__ = "price_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("dynamic_pricing_rules.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)  # "RULE_CREATED", "RULE_APPROVED", "RULE_ARCHIVED", "PRICING_APPLIED"
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

