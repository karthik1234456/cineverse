# backend/app/models/tax.py
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, ForeignKey,
    JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


class TaxItemTypeEnum(str, enum.Enum):
    TICKET = "TICKET"
    CONVENIENCE_FEE = "CONVENIENCE_FEE"
    FOOD_BEVERAGE = "FOOD_BEVERAGE"


class SupplierModelEnum(str, enum.Enum):
    CINEMA = "CINEMA"
    PLATFORM = "PLATFORM"


class InvoiceTypeEnum(str, enum.Enum):
    TAX_INVOICE = "TAX_INVOICE"
    CREDIT_NOTE = "CREDIT_NOTE"


class TaxRule(Base):
    """
    Effective-dated tax rules.
    Rates and thresholds are loaded dynamically from this table, never hard-coded in code.
    Until confirmed by a chartered accountant, rules are marked is_confirmed_by_ca=False.
    """
    __tablename__ = "tax_rules"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String(50), nullable=False, index=True)  # TICKET, CONVENIENCE_FEE, FOOD_BEVERAGE
    sac_hsn_code = Column(String(20), nullable=False)  # e.g., SAC 999612 / 999613 / 998599 / HSN 210690
    description = Column(String(255), nullable=False)
    
    # Rate in percentage (e.g. 18.0 for 18%, 12.0 for 12%, 5.0 for 5%)
    # Stored as decimal percentage for human readability; calculations convert to integer basis points/paise
    rate_percent = Column(Float, nullable=False)
    
    # Slab threshold in integer paise (e.g. for movie tickets: up to ₹100 = 10000 paise vs above ₹100)
    min_price_paise = Column(Integer, nullable=True, default=0)
    max_price_paise = Column(Integer, nullable=True)  # None = no upper bound
    
    # Effective validity dates
    valid_from = Column(DateTime, nullable=False, default=datetime.utcnow)
    valid_to = Column(DateTime, nullable=True)  # None = currently active
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_confirmed_by_ca = Column(Boolean, default=False, nullable=False)
    confirmation_notes = Column(String(500), default="Placeholder - to be confirmed by a chartered accountant")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TaxEntity(Base):
    """
    Legal details for platform and cinemas (GSTIN, PAN, Registered Address, State Code).
    """
    __tablename__ = "tax_entities"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(20), nullable=False)  # PLATFORM, CINEMA
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="SET NULL"), nullable=True, unique=True)
    
    legal_name = Column(String(255), nullable=False)  # e.g., "CineVerse Digital Entertainment Private Limited"
    trade_name = Column(String(255), nullable=False)  # e.g., "CineVerse"
    gstin = Column(String(15), nullable=False, index=True)  # 15-char GSTIN
    pan = Column(String(10), nullable=False)  # 10-char PAN
    cin = Column(String(30), nullable=True)  # Corporate Identification Number
    
    registered_address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)  # e.g., "Telangana"
    state_code = Column(String(2), nullable=False)  # 2-digit GST state code (e.g. "36")
    pincode = Column(String(10), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cinema = relationship("Cinema", backref="tax_entity", uselist=False)


class TaxSetting(Base):
    """
    Global configuration for supplier models (who is the supplier on ticket vs convenience fee).
    """
    __tablename__ = "tax_settings"

    id = Column(Integer, primary_key=True, index=True)
    # Who is the legal supplier on ticket invoice? (CINEMA vs PLATFORM)
    ticket_supplier_model = Column(String(20), default="CINEMA", nullable=False)
    # Who is the legal supplier on convenience fee invoice? (PLATFORM vs CINEMA)
    convenience_fee_supplier_model = Column(String(20), default="PLATFORM", nullable=False)
    
    platform_entity_id = Column(Integer, ForeignKey("tax_entities.id"), nullable=True)
    e_commerce_operator_gstin = Column(String(15), nullable=True)
    tcs_applicable = Column(Boolean, default=False)
    rounding_mode = Column(String(20), default="HALF_UP")  # HALF_UP
    notes = Column(String(500), default="Awaiting chartered accountant confirmation on ECO Sec 9(5) vs Sec 52 TCS")
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    platform_entity = relationship("TaxEntity")


class InvoiceSequence(Base):
    """
    Strictly gap-free sequential invoice numbering per financial year, per issuer entity and series.
    Uses atomic increment with concurrency protection.
    """
    __tablename__ = "invoice_sequences"
    __table_args__ = (
        UniqueConstraint("issuer_entity_id", "financial_year", "series_prefix", name="uq_invoice_seq_issuer_fy_prefix"),
    )

    id = Column(Integer, primary_key=True, index=True)
    issuer_entity_id = Column(Integer, ForeignKey("tax_entities.id", ondelete="CASCADE"), nullable=False)
    financial_year = Column(String(10), nullable=False)  # e.g. "2026-27"
    series_prefix = Column(String(20), nullable=False)   # e.g. "CV-INV", "CV-CN", "CIN-INV"
    last_number = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Invoice(Base):
    """
    Immutable tax invoice or credit note record.
    Once issued, the buyer, seller, tax rates, and line item details are frozen snapshots.
    Future changes to cinema profiles or tax rules NEVER alter past invoices.
    """
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(64), unique=True, index=True, nullable=False)  # e.g. "CV/26-27/000001"
    invoice_type = Column(String(20), default="TAX_INVOICE", nullable=False)       # TAX_INVOICE, CREDIT_NOTE
    financial_year = Column(String(10), nullable=False, index=True)               # e.g. "2026-27"
    
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    original_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True) # For Credit Notes
    issuer_entity_id = Column(Integer, ForeignKey("tax_entities.id"), nullable=False)
    issuer_type = Column(String(20), nullable=False)                              # PLATFORM, CINEMA
    
    invoice_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Place of supply determination
    place_of_supply_state = Column(String(100), nullable=False)
    place_of_supply_state_code = Column(String(2), nullable=False)
    is_inter_state = Column(Boolean, default=False, nullable=False)
    is_reverse_charge = Column(Boolean, default=False, nullable=False)
    
    # Draft status & CA confirmation watermark
    is_draft = Column(Boolean, default=True, nullable=False)
    watermark_text = Column(String(255), default="DRAFT INVOICE — RATES & RULES TO BE CONFIRMED BY CHARTERED ACCOUNTANT")
    
    # Immutable Snapshots
    seller_snapshot = Column(JSON, nullable=False)  # { legal_name, trade_name, gstin, pan, address, state, state_code }
    buyer_snapshot = Column(JSON, nullable=False)   # { name, email, phone, customer_gstin, business_name, address, state_code }
    
    # Financial Totals in Integer Paise
    gross_amount_paise = Column(Integer, nullable=False, default=0)
    discount_amount_paise = Column(Integer, nullable=False, default=0)
    taxable_amount_paise = Column(Integer, nullable=False, default=0)
    cgst_amount_paise = Column(Integer, nullable=False, default=0)
    sgst_amount_paise = Column(Integer, nullable=False, default=0)
    igst_amount_paise = Column(Integer, nullable=False, default=0)
    total_tax_paise = Column(Integer, nullable=False, default=0)
    final_total_paise = Column(Integer, nullable=False, default=0)
    
    rounding_difference_paise = Column(Integer, default=0)
    notes = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    booking = relationship("Booking", backref="invoices")
    issuer_entity = relationship("TaxEntity")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    credit_notes = relationship("Invoice", backref="original_invoice", remote_side=[id])


class InvoiceItem(Base):
    """
    Individual line items on an invoice, capturing exact SAC/HSN codes and integer paise tax splits.
    """
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    item_type = Column(String(50), nullable=False)  # TICKET, CONVENIENCE_FEE, FOOD_BEVERAGE
    description = Column(String(255), nullable=False)
    sac_hsn_code = Column(String(20), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    
    unit_price_paise = Column(Integer, nullable=False)
    gross_amount_paise = Column(Integer, nullable=False)
    discount_paise = Column(Integer, default=0, nullable=False)
    taxable_amount_paise = Column(Integer, nullable=False)
    
    tax_rule_id = Column(Integer, ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)
    tax_rate_percent = Column(Float, nullable=False)
    
    cgst_rate = Column(Float, default=0.0, nullable=False)
    cgst_paise = Column(Integer, default=0, nullable=False)
    sgst_rate = Column(Float, default=0.0, nullable=False)
    sgst_paise = Column(Integer, default=0, nullable=False)
    igst_rate = Column(Float, default=0.0, nullable=False)
    igst_paise = Column(Integer, default=0, nullable=False)
    
    total_item_paise = Column(Integer, nullable=False)

    invoice = relationship("Invoice", back_populates="items")
    tax_rule = relationship("TaxRule")
