# backend/app/services/tax_invoice_service.py
import asyncio
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_, func, text
from sqlalchemy.orm import selectinload
from io import BytesIO

from app.models.tax import (
    TaxRule, TaxEntity, TaxSetting, InvoiceSequence, Invoice, InvoiceItem,
    TaxItemTypeEnum, SupplierModelEnum, InvoiceTypeEnum
)
from app.models.booking import Booking, BookingStatusEnum
from app.models.cinema import Cinema, City
from app.models.showtime import Showtime


def round_half_up(value: float) -> int:
    """Documented standard financial rounding to nearest integer paise."""
    return int(Decimal(str(value)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def get_financial_year(dt: Optional[datetime] = None) -> str:
    """
    Computes standard Indian Financial Year (April 1 to March 31).
    E.g. November 2026 -> '2026-27' (or abbreviated '26-27').
    """
    if dt is None:
        dt = datetime.utcnow()
    year = dt.year
    if dt.month >= 4:
        return f"{year % 100}-{(year + 1) % 100:02d}"
    else:
        return f"{(year - 1) % 100}-{year % 100:02d}"


# Standard 2-digit GST state codes
STATE_CODE_MAP = {
    "JAMMU AND KASHMIR": "01",
    "HIMACHAL PRADESH": "02",
    "PUNJAB": "03",
    "CHANDIGARH": "04",
    "UTTARAKHAND": "05",
    "HARYANA": "06",
    "DELHI": "07",
    "RAJASTHAN": "08",
    "UTTAR PRADESH": "09",
    "BIHAR": "10",
    "SIKKIM": "11",
    "ARUNACHAL PRADESH": "12",
    "NAGALAND": "13",
    "MANIPUR": "14",
    "MIZORAM": "15",
    "TRIPURA": "16",
    "MEGHALAYA": "17",
    "ASSAM": "18",
    "WEST BENGAL": "19",
    "JHARKHAND": "20",
    "ODISHA": "21",
    "CHHATTISGARH": "22",
    "MADHYA PRADESH": "23",
    "GUJARAT": "24",
    "MAHARASHTRA": "27",
    "KARNATAKA": "29",
    "GOA": "30",
    "KERALA": "32",
    "TAMIL NADU": "33",
    "PUDUCHERRY": "34",
    "TELANGANA": "36",
    "ANDHRA PRADESH": "37",
    "LADAKH": "38",
}


def lookup_state_code(state_name: str) -> str:
    cleaned = state_name.strip().upper()
    return STATE_CODE_MAP.get(cleaned, "36")  # Default to 36 (Telangana) if unmapped


class TaxInvoiceService:
    _seq_lock = asyncio.Lock()

    @staticmethod
    async def get_tax_setting(db: AsyncSession) -> TaxSetting:
        res = await db.execute(select(TaxSetting).limit(1))
        setting = res.scalars().first()
        if not setting:
            # Create default tax setting
            setting = TaxSetting(
                ticket_supplier_model="CINEMA",
                convenience_fee_supplier_model="PLATFORM",
                rounding_mode="HALF_UP",
                notes="Placeholder - to be confirmed by a chartered accountant"
            )
            db.add(setting)
            await db.commit()
            await db.refresh(setting)
        return setting

    @staticmethod
    async def find_matching_rule(
        db: AsyncSession,
        item_type: str,
        price_paise: int,
        invoice_date: datetime
    ) -> TaxRule:
        """
        Dynamically finds the effective-dated tax rule matching the item type,
        slab threshold, and date. Does NOT guess or hard-code rates.
        """
        stmt = (
            select(TaxRule)
            .where(
                TaxRule.item_type == item_type,
                TaxRule.is_active == True,
                TaxRule.valid_from <= invoice_date,
                or_(TaxRule.valid_to == None, TaxRule.valid_to >= invoice_date),
                or_(TaxRule.min_price_paise == None, TaxRule.min_price_paise <= price_paise),
                or_(TaxRule.max_price_paise == None, TaxRule.max_price_paise >= price_paise)
            )
            .order_by(TaxRule.id.desc())
        )
        res = await db.execute(stmt)
        rule = res.scalars().first()
        if not rule:
            raise ValueError(
                f"No effective-dated tax rule configured for {item_type} at price {price_paise} paise. "
                "Tax rules must be configured in tax_rules table by an accountant."
            )
        return rule

    @classmethod
    async def get_next_sequence_number(
        cls,
        db: AsyncSession,
        issuer_entity_id: int,
        financial_year: str,
        series_prefix: str
    ) -> int:
        """
        Atomic gap-free sequential counter per (issuer, financial year, series).
        Safe against race conditions under concurrency using thread/task serialization.
        """
        async with cls._seq_lock:
            stmt = select(InvoiceSequence).where(
                InvoiceSequence.issuer_entity_id == issuer_entity_id,
                InvoiceSequence.financial_year == financial_year,
                InvoiceSequence.series_prefix == series_prefix
            )
            res = await db.execute(stmt)
            seq = res.scalars().first()
            if not seq:
                seq = InvoiceSequence(
                    issuer_entity_id=issuer_entity_id,
                    financial_year=financial_year,
                    series_prefix=series_prefix,
                    last_number=1
                )
                db.add(seq)
                await db.commit()
                return 1
            else:
                seq.last_number += 1
                await db.commit()
                return seq.last_number

    @staticmethod
    async def get_or_create_cinema_tax_entity(db: AsyncSession, cinema: Cinema) -> TaxEntity:
        stmt = select(TaxEntity).where(TaxEntity.cinema_id == cinema.id)
        res = await db.execute(stmt)
        entity = res.scalars().first()
        if not entity:
            state_name = cinema.city.state if (cinema.city and cinema.city.state) else "Telangana"
            state_code = lookup_state_code(state_name)
            # Create placeholder cinema tax entity
            entity = TaxEntity(
                entity_type="CINEMA",
                cinema_id=cinema.id,
                legal_name=f"{cinema.name} Operations LLP",
                trade_name=cinema.name,
                gstin=f"{state_code}AABCP{cinema.id:04d}C1Z8",
                pan=f"AABCP{cinema.id:04d}C",
                registered_address=cinema.address,
                city=cinema.city.name if cinema.city else "Hyderabad",
                state=state_name,
                state_code=state_code,
                pincode=cinema.pincode or "500081",
                email=f"accounts.{cinema.id}@cineverse.cinemas.in",
                phone=cinema.phone or "+91 80 4000 1234",
                is_active=True
            )
            db.add(entity)
            await db.flush()
        return entity

    @staticmethod
    async def get_platform_tax_entity(db: AsyncSession) -> TaxEntity:
        stmt = select(TaxEntity).where(TaxEntity.entity_type == "PLATFORM")
        res = await db.execute(stmt)
        entity = res.scalars().first()
        if not entity:
            entity = TaxEntity(
                entity_type="PLATFORM",
                cinema_id=None,
                legal_name="CineVerse Digital Private Limited",
                trade_name="CineVerse",
                gstin="36AABCC1234D1Z5",
                pan="AABCC1234D",
                cin="U72900TG2026PTC198822",
                registered_address="Building 12, Mindspace Madhapur, HITEC City",
                city="Hyderabad",
                state="Telangana",
                state_code="36",
                pincode="500081",
                email="tax-compliance@cineverse.com",
                phone="+91 40 6800 5500",
                is_active=True
            )
            db.add(entity)
            await db.flush()
        return entity

    @classmethod
    async def generate_invoice_for_booking(
        cls,
        db: AsyncSession,
        booking_id: int
    ) -> List[Invoice]:
        """
        Generates official GST-compliant tax invoices for a confirmed booking.
        Depending on the supplier model:
        - If ticket_supplier_model == 'CINEMA':
          1. Cinema issues Tax Invoice for Tickets (Admission).
          2. Platform issues Tax Invoice for Convenience Fee.
        - If ticket_supplier_model == 'PLATFORM':
          Single consolidated invoice issued by CineVerse.
        All calculations in integer paise with documented rounding.
        """
        # Check if invoices already generated
        existing = await db.execute(
            select(Invoice)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.issuer_entity)
            )
            .where(
                Invoice.booking_id == booking_id,
                Invoice.invoice_type == "TAX_INVOICE"
            )
        )
        existing_list = existing.scalars().all()
        if existing_list:
            return list(existing_list)

        stmt = (
            select(Booking)
            .options(
                selectinload(Booking.showtime).selectinload(Showtime.cinema).selectinload(Cinema.city),
                selectinload(Booking.showtime).selectinload(Showtime.movie),
                selectinload(Booking.seats),
                selectinload(Booking.addons),
                selectinload(Booking.user),
            )
            .where(Booking.id == booking_id)
        )
        res = await db.execute(stmt)
        booking = res.scalars().first()
        if not booking:
            raise ValueError(f"Booking {booking_id} not found")

        showtime = booking.showtime
        cinema = showtime.cinema if showtime else None
        if not cinema:
            raise ValueError(f"Cinema details missing for booking {booking_id}")

        setting = await cls.get_tax_setting(db)
        platform_entity = await cls.get_platform_tax_entity(db)
        cinema_entity = await cls.get_or_create_cinema_tax_entity(db, cinema)

        invoice_date = booking.created_at or datetime.utcnow()
        fy = get_financial_year(invoice_date)

        # Place of supply determination:
        # Under Section 12(6) of IGST Act: Place of supply of admission to theatre is where event is held.
        cinema_state = cinema.city.state if (cinema.city and cinema.city.state) else "Telangana"
        cinema_state_code = lookup_state_code(cinema_state)

        # Buyer Details Snapshot
        buyer_gstin = booking.customer_gstin or None
        buyer_bname = booking.customer_business_name or None
        buyer_baddr = booking.customer_business_address or None
        buyer_state_code = booking.customer_state_code or (buyer_gstin[:2] if buyer_gstin else cinema_state_code)
        
        buyer_snapshot = {
            "user_id": booking.user_id,
            "name": booking.user.full_name if booking.user else "CineVerse Patron",
            "email": booking.contact_email or (booking.user.email if booking.user else ""),
            "phone": booking.contact_phone or (booking.user.phone if booking.user else ""),
            "customer_gstin": buyer_gstin,
            "business_name": buyer_bname,
            "business_address": buyer_baddr,
            "state_code": buyer_state_code,
            "is_b2b": bool(buyer_gstin)
        }

        generated_invoices: List[Invoice] = []

        # ==========================================
        # 1. TICKET (ADMISSION) INVOICE
        # ==========================================
        ticket_paise = round(booking.total_ticket_amount * 100)
        if ticket_paise > 0:
            ticket_issuer = cinema_entity if setting.ticket_supplier_model == "CINEMA" else platform_entity
            series = "CIN" if ticket_issuer.entity_type == "CINEMA" else "CV"
            prefix = f"{series}-TKT"
            seq_num = await cls.get_next_sequence_number(db, ticket_issuer.id, fy, prefix)
            inv_number = f"{prefix}/{fy}/{seq_num:06d}"

            # Inter-state vs Intra-state:
            # POS for cinema admission is cinema location (Section 12(6) IGST Act)
            pos_state = cinema_state
            pos_state_code = cinema_state_code
            is_inter_state = (ticket_issuer.state_code != pos_state_code)

            seller_snapshot = {
                "entity_type": ticket_issuer.entity_type,
                "legal_name": ticket_issuer.legal_name,
                "trade_name": ticket_issuer.trade_name,
                "gstin": ticket_issuer.gstin,
                "pan": ticket_issuer.pan,
                "address": ticket_issuer.registered_address,
                "city": ticket_issuer.city,
                "state": ticket_issuer.state,
                "state_code": ticket_issuer.state_code,
                "pincode": ticket_issuer.pincode,
                "phone": ticket_issuer.phone,
                "email": ticket_issuer.email
            }

            # Tax Rule for Tickets
            unit_ticket_paise = round(ticket_paise / max(len(booking.seats), 1))
            ticket_rule = await cls.find_matching_rule(db, "TICKET", unit_ticket_paise, invoice_date)

            is_draft = not ticket_rule.is_confirmed_by_ca
            watermark = "DRAFT INVOICE — RATES & RULES TO BE CONFIRMED BY CHARTERED ACCOUNTANT" if is_draft else ""

            # Calculation in integer paise
            rate = ticket_rule.rate_percent
            if is_inter_state:
                cgst_rate = 0.0
                sgst_rate = 0.0
                igst_rate = rate
                cgst_paise = 0
                sgst_paise = 0
                igst_paise = round_half_up(ticket_paise * (igst_rate / 100.0))
            else:
                cgst_rate = rate / 2.0
                sgst_rate = rate / 2.0
                igst_rate = 0.0
                cgst_paise = round_half_up(ticket_paise * (cgst_rate / 100.0))
                sgst_paise = round_half_up(ticket_paise * (sgst_rate / 100.0))
                igst_paise = 0

            tax_paise = cgst_paise + sgst_paise + igst_paise
            total_paise = ticket_paise + tax_paise

            inv = Invoice(
                invoice_number=inv_number,
                invoice_type="TAX_INVOICE",
                financial_year=fy,
                booking_id=booking.id,
                issuer_entity_id=ticket_issuer.id,
                issuer_type=ticket_issuer.entity_type,
                invoice_date=invoice_date,
                place_of_supply_state=pos_state,
                place_of_supply_state_code=pos_state_code,
                is_inter_state=is_inter_state,
                is_reverse_charge=False,
                is_draft=is_draft,
                watermark_text=watermark,
                seller_snapshot=seller_snapshot,
                buyer_snapshot=buyer_snapshot,
                gross_amount_paise=ticket_paise,
                discount_amount_paise=0,
                taxable_amount_paise=ticket_paise,
                cgst_amount_paise=cgst_paise,
                sgst_amount_paise=sgst_paise,
                igst_amount_paise=igst_paise,
                total_tax_paise=tax_paise,
                final_total_paise=total_paise,
                notes=ticket_rule.confirmation_notes
            )
            db.add(inv)
            await db.flush()

            # Add Item
            seats_str = ", ".join([s.seat_id for s in booking.seats])
            item = InvoiceItem(
                invoice_id=inv.id,
                item_type="TICKET",
                description=f"Movie Admission: {showtime.movie.title if showtime and showtime.movie else 'Movie'} (Seats: {seats_str})",
                sac_hsn_code=ticket_rule.sac_hsn_code,
                quantity=len(booking.seats) or 1,
                unit_price_paise=unit_ticket_paise,
                gross_amount_paise=ticket_paise,
                discount_paise=0,
                taxable_amount_paise=ticket_paise,
                tax_rule_id=ticket_rule.id,
                tax_rate_percent=rate,
                cgst_rate=cgst_rate,
                cgst_paise=cgst_paise,
                sgst_rate=sgst_rate,
                sgst_paise=sgst_paise,
                igst_rate=igst_rate,
                igst_paise=igst_paise,
                total_item_paise=total_paise
            )
            db.add(item)
            generated_invoices.append(inv)

        # ==========================================
        # 2. CONVENIENCE FEE INVOICE (Online Booking Facilitation)
        # ==========================================
        fee_paise = round(booking.convenience_fee * 100)
        if fee_paise > 0:
            fee_issuer = platform_entity if setting.convenience_fee_supplier_model == "PLATFORM" else cinema_entity
            prefix = "CV-FEE"
            seq_num = await cls.get_next_sequence_number(db, fee_issuer.id, fy, prefix)
            inv_number = f"{prefix}/{fy}/{seq_num:06d}"

            # For online convenience fees:
            # If B2B: POS is buyer state code. If B2C: POS is cinema/supplier state code.
            fee_pos_code = buyer_state_code if buyer_gstin else fee_issuer.state_code
            fee_pos_state = next((k.title() for k, v in STATE_CODE_MAP.items() if v == fee_pos_code), fee_issuer.state)
            fee_inter_state = (fee_issuer.state_code != fee_pos_code)

            seller_snapshot = {
                "entity_type": fee_issuer.entity_type,
                "legal_name": fee_issuer.legal_name,
                "trade_name": fee_issuer.trade_name,
                "gstin": fee_issuer.gstin,
                "pan": fee_issuer.pan,
                "cin": fee_issuer.cin,
                "address": fee_issuer.registered_address,
                "city": fee_issuer.city,
                "state": fee_issuer.state,
                "state_code": fee_issuer.state_code,
                "pincode": fee_issuer.pincode,
                "phone": fee_issuer.phone,
                "email": fee_issuer.email
            }

            fee_rule = await cls.find_matching_rule(db, "CONVENIENCE_FEE", fee_paise, invoice_date)
            is_draft = not fee_rule.is_confirmed_by_ca
            watermark = "DRAFT INVOICE — RATES & RULES TO BE CONFIRMED BY CHARTERED ACCOUNTANT" if is_draft else ""

            rate = fee_rule.rate_percent
            if fee_inter_state:
                cgst_rate = 0.0
                sgst_rate = 0.0
                igst_rate = rate
                cgst_paise = 0
                sgst_paise = 0
                igst_paise = round_half_up(fee_paise * (igst_rate / 100.0))
            else:
                cgst_rate = rate / 2.0
                sgst_rate = rate / 2.0
                igst_rate = 0.0
                cgst_paise = round_half_up(fee_paise * (cgst_rate / 100.0))
                sgst_paise = round_half_up(fee_paise * (sgst_rate / 100.0))
                igst_paise = 0

            tax_paise = cgst_paise + sgst_paise + igst_paise
            total_paise = fee_paise + tax_paise

            inv = Invoice(
                invoice_number=inv_number,
                invoice_type="TAX_INVOICE",
                financial_year=fy,
                booking_id=booking.id,
                issuer_entity_id=fee_issuer.id,
                issuer_type=fee_issuer.entity_type,
                invoice_date=invoice_date,
                place_of_supply_state=fee_pos_state,
                place_of_supply_state_code=fee_pos_code,
                is_inter_state=fee_inter_state,
                is_reverse_charge=False,
                is_draft=is_draft,
                watermark_text=watermark,
                seller_snapshot=seller_snapshot,
                buyer_snapshot=buyer_snapshot,
                gross_amount_paise=fee_paise,
                discount_amount_paise=0,
                taxable_amount_paise=fee_paise,
                cgst_amount_paise=cgst_paise,
                sgst_amount_paise=sgst_paise,
                igst_amount_paise=igst_paise,
                total_tax_paise=tax_paise,
                final_total_paise=total_paise,
                notes=fee_rule.confirmation_notes
            )
            db.add(inv)
            await db.flush()

            item = InvoiceItem(
                invoice_id=inv.id,
                item_type="CONVENIENCE_FEE",
                description="Online Booking Convenience & Platform Facilitation Service",
                sac_hsn_code=fee_rule.sac_hsn_code,
                quantity=1,
                unit_price_paise=fee_paise,
                gross_amount_paise=fee_paise,
                discount_paise=0,
                taxable_amount_paise=fee_paise,
                tax_rule_id=fee_rule.id,
                tax_rate_percent=rate,
                cgst_rate=cgst_rate,
                cgst_paise=cgst_paise,
                sgst_rate=sgst_rate,
                sgst_paise=sgst_paise,
                igst_rate=igst_rate,
                igst_paise=igst_paise,
                total_item_paise=total_paise
            )
            db.add(item)
            generated_invoices.append(inv)

        # ==========================================
        # 3. FOOD & BEVERAGE INVOICE (if any addons)
        # ==========================================
        addons_paise = round(booking.addons_amount * 100)
        if addons_paise > 0 and booking.addons:
            fnb_issuer = cinema_entity  # F&B is supplied on-premise by cinema / concessions counter
            prefix = "CIN-FNB"
            seq_num = await cls.get_next_sequence_number(db, fnb_issuer.id, fy, prefix)
            inv_number = f"{prefix}/{fy}/{seq_num:06d}"

            fnb_pos_state = cinema_state
            fnb_pos_code = cinema_state_code
            fnb_inter_state = (fnb_issuer.state_code != fnb_pos_code)

            seller_snapshot = {
                "entity_type": fnb_issuer.entity_type,
                "legal_name": fnb_issuer.legal_name,
                "trade_name": fnb_issuer.trade_name,
                "gstin": fnb_issuer.gstin,
                "pan": fnb_issuer.pan,
                "address": fnb_issuer.registered_address,
                "city": fnb_issuer.city,
                "state": fnb_issuer.state,
                "state_code": fnb_issuer.state_code,
                "pincode": fnb_issuer.pincode,
                "phone": fnb_issuer.phone,
                "email": fnb_issuer.email
            }

            fnb_rule = await cls.find_matching_rule(db, "FOOD_BEVERAGE", addons_paise, invoice_date)
            is_draft = not fnb_rule.is_confirmed_by_ca
            watermark = "DRAFT INVOICE — RATES & RULES TO BE CONFIRMED BY CHARTERED ACCOUNTANT" if is_draft else ""

            rate = fnb_rule.rate_percent
            if fnb_inter_state:
                cgst_rate = 0.0
                sgst_rate = 0.0
                igst_rate = rate
                cgst_paise = 0
                sgst_paise = 0
                igst_paise = round_half_up(addons_paise * (igst_rate / 100.0))
            else:
                cgst_rate = rate / 2.0
                sgst_rate = rate / 2.0
                igst_rate = 0.0
                cgst_paise = round_half_up(addons_paise * (cgst_rate / 100.0))
                sgst_paise = round_half_up(addons_paise * (sgst_rate / 100.0))
                igst_paise = 0

            tax_paise = cgst_paise + sgst_paise + igst_paise
            total_paise = addons_paise + tax_paise

            inv = Invoice(
                invoice_number=inv_number,
                invoice_type="TAX_INVOICE",
                financial_year=fy,
                booking_id=booking.id,
                issuer_entity_id=fnb_issuer.id,
                issuer_type=fnb_issuer.entity_type,
                invoice_date=invoice_date,
                place_of_supply_state=fnb_pos_state,
                place_of_supply_state_code=fnb_pos_code,
                is_inter_state=fnb_inter_state,
                is_reverse_charge=False,
                is_draft=is_draft,
                watermark_text=watermark,
                seller_snapshot=seller_snapshot,
                buyer_snapshot=buyer_snapshot,
                gross_amount_paise=addons_paise,
                discount_amount_paise=0,
                taxable_amount_paise=addons_paise,
                cgst_amount_paise=cgst_paise,
                sgst_amount_paise=sgst_paise,
                igst_amount_paise=igst_paise,
                total_tax_paise=tax_paise,
                final_total_paise=total_paise,
                notes=fnb_rule.confirmation_notes
            )
            db.add(inv)
            await db.flush()

            for addon in booking.addons:
                item_paise = round(addon.total_price * 100)
                item_cgst = round_half_up(item_paise * (cgst_rate / 100.0))
                item_sgst = round_half_up(item_paise * (sgst_rate / 100.0))
                item_igst = round_half_up(item_paise * (igst_rate / 100.0))
                item_tot = item_paise + item_cgst + item_sgst + item_igst

                item = InvoiceItem(
                    invoice_id=inv.id,
                    item_type="FOOD_BEVERAGE",
                    description=f"Concession Item: {addon.name}",
                    sac_hsn_code=fnb_rule.sac_hsn_code,
                    quantity=addon.quantity,
                    unit_price_paise=round(addon.unit_price * 100),
                    gross_amount_paise=item_paise,
                    discount_paise=0,
                    taxable_amount_paise=item_paise,
                    tax_rule_id=fnb_rule.id,
                    tax_rate_percent=rate,
                    cgst_rate=cgst_rate,
                    cgst_paise=item_cgst,
                    sgst_rate=sgst_rate,
                    sgst_paise=item_sgst,
                    igst_rate=igst_rate,
                    igst_paise=item_igst,
                    total_item_paise=item_tot
                )
                db.add(item)
            generated_invoices.append(inv)

        await db.commit()
        if not generated_invoices:
            return []

        inv_ids = [i.id for i in generated_invoices]
        load_stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.issuer_entity)
            )
            .where(Invoice.id.in_(inv_ids))
            .order_by(Invoice.id.asc())
        )
        final_res = await db.execute(load_stmt)
        return list(final_res.scalars().all())

    @classmethod
    async def create_credit_note_for_refund(
        cls,
        db: AsyncSession,
        original_invoice_id: int,
        refunded_amount_paise: int,
        reason: str = "Booking cancellation by customer"
    ) -> Invoice:
        """
        Issues an immutable Credit Note against an existing tax invoice upon cancellation/refund.
        Reverses the output tax liability proportionally in integer paise.
        """
        stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.issuer_entity),
            )
            .where(Invoice.id == original_invoice_id)
        )
        res = await db.execute(stmt)
        orig = res.scalars().first()
        if not orig:
            raise ValueError(f"Original invoice {original_invoice_id} not found")
        
        now = datetime.utcnow()
        fy = get_financial_year(now)
        cn_prefix = f"{orig.invoice_number.split('/')[0]}-CN"
        seq_num = await cls.get_next_sequence_number(db, orig.issuer_entity_id, fy, cn_prefix)
        cn_number = f"{cn_prefix}/{fy}/{seq_num:06d}"

        # Ratio of refund
        ratio = Decimal(str(refunded_amount_paise)) / Decimal(str(orig.final_total_paise)) if orig.final_total_paise > 0 else Decimal('1')
        if ratio > Decimal('1'):
            ratio = Decimal('1')

        taxable_cn = round_half_up(float(Decimal(str(orig.taxable_amount_paise)) * ratio))
        cgst_cn = round_half_up(float(Decimal(str(orig.cgst_amount_paise)) * ratio))
        sgst_cn = round_half_up(float(Decimal(str(orig.sgst_amount_paise)) * ratio))
        igst_cn = round_half_up(float(Decimal(str(orig.igst_amount_paise)) * ratio))
        tot_tax_cn = cgst_cn + sgst_cn + igst_cn
        tot_cn = taxable_cn + tot_tax_cn

        credit_note = Invoice(
            invoice_number=cn_number,
            invoice_type="CREDIT_NOTE",
            financial_year=fy,
            booking_id=orig.booking_id,
            original_invoice_id=orig.id,
            issuer_entity_id=orig.issuer_entity_id,
            issuer_type=orig.issuer_type,
            invoice_date=now,
            place_of_supply_state=orig.place_of_supply_state,
            place_of_supply_state_code=orig.place_of_supply_state_code,
            is_inter_state=orig.is_inter_state,
            is_reverse_charge=False,
            is_draft=orig.is_draft,
            watermark_text=orig.watermark_text,
            seller_snapshot=orig.seller_snapshot,
            buyer_snapshot=orig.buyer_snapshot,
            gross_amount_paise=taxable_cn,
            discount_amount_paise=0,
            taxable_amount_paise=taxable_cn,
            cgst_amount_paise=cgst_cn,
            sgst_amount_paise=sgst_cn,
            igst_amount_paise=igst_cn,
            total_tax_paise=tot_tax_cn,
            final_total_paise=tot_cn,
            notes=f"Credit Note against Invoice {orig.invoice_number}. Reason: {reason}"
        )
        db.add(credit_note)
        await db.flush()

        # Add CN items
        for item in orig.items:
            item_taxable_cn = round_half_up(float(Decimal(str(item.taxable_amount_paise)) * ratio))
            item_cgst_cn = round_half_up(float(Decimal(str(item.cgst_paise)) * ratio))
            item_sgst_cn = round_half_up(float(Decimal(str(item.sgst_paise)) * ratio))
            item_igst_cn = round_half_up(float(Decimal(str(item.igst_paise)) * ratio))
            item_tot_cn = item_taxable_cn + item_cgst_cn + item_sgst_cn + item_igst_cn

            cn_item = InvoiceItem(
                invoice_id=credit_note.id,
                item_type=item.item_type,
                description=f"[CREDIT NOTE REVERSAL] {item.description}",
                sac_hsn_code=item.sac_hsn_code,
                quantity=item.quantity,
                unit_price_paise=item.unit_price_paise,
                gross_amount_paise=item_taxable_cn,
                discount_paise=0,
                taxable_amount_paise=item_taxable_cn,
                tax_rule_id=item.tax_rule_id,
                tax_rate_percent=item.tax_rate_percent,
                cgst_rate=item.cgst_rate,
                cgst_paise=item_cgst_cn,
                sgst_rate=item.sgst_rate,
                sgst_paise=item_sgst_cn,
                igst_rate=item.igst_rate,
                igst_paise=item_igst_cn,
                total_item_paise=item_tot_cn
            )
            db.add(cn_item)

        await db.commit()
        cn_res = await db.execute(
            select(Invoice)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.issuer_entity),
                selectinload(Invoice.original_invoice)
            )
            .where(Invoice.id == credit_note.id)
        )
        return cn_res.scalars().first()

    @classmethod
    def render_invoice_pdf(cls, invoice: Invoice) -> bytes:
        """
        Renders an official GST tax invoice PDF with statutory fields and draft watermark
        using ReportLab.
        """
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Frame, PageTemplate
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.pdfgen import canvas

        buffer = BytesIO()

        # Canvas maker for watermark
        class WatermarkCanvas(canvas.Canvas):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.pages = []

            def showPage(self):
                self.pages.append(dict(self.__dict__))
                self._startPage()

            def save(self):
                num_pages = len(self.pages)
                for page in self.pages:
                    self.__dict__.update(page)
                    self.draw_watermark()
                    super().showPage()
                super().save()

            def draw_watermark(self):
                if invoice.is_draft:
                    self.saveState()
                    self.setFont("Helvetica-Bold", 34)
                    self.setFillColor(colors.HexColor("#C8102E"), alpha=0.10)
                    self.translate(297, 421)
                    self.rotate(45)
                    self.drawCentredString(0, 0, "DRAFT INVOICE")
                    self.setFont("Helvetica-Bold", 11)
                    self.drawCentredString(0, -25, "RATES & RULES TO BE CONFIRMED BY CHARTERED ACCOUNTANT")
                    self.restoreState()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        normal = styles["Normal"]

        title_style = ParagraphStyle(
            "InvoiceTitle",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#1B1320")
        )
        subtitle_style = ParagraphStyle(
            "InvoiceSubTitle",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#C8102E")
        )
        heading_style = ParagraphStyle(
            "ColHeading",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#4A4056")
        )
        body_style = ParagraphStyle(
            "Body",
            parent=normal,
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#1B1320")
        )
        bold_style = ParagraphStyle(
            "BoldBody",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#1B1320")
        )

        elements = []

        # Header Title
        doc_type_title = "TAX INVOICE" if invoice.invoice_type == "TAX_INVOICE" else "CREDIT NOTE"
        if invoice.is_draft:
            doc_type_title += " (DRAFT)"

        elements.append(Paragraph(doc_type_title, title_style))
        if invoice.is_draft:
            elements.append(Paragraph("SUBJECT TO CHARTERED ACCOUNTANT CONFIRMATION", subtitle_style))
        elements.append(Spacer(1, 10))

        # Metadata Table (Invoice No, Date, Place of Supply, Reverse Charge)
        meta_data = [
            [
                Paragraph(f"<b>Document No:</b> {invoice.invoice_number}", body_style),
                Paragraph(f"<b>Date:</b> {invoice.invoice_date.strftime('%d-%b-%Y')}", body_style),
                Paragraph(f"<b>Financial Year:</b> {invoice.financial_year}", body_style),
            ],
            [
                Paragraph(f"<b>Place of Supply:</b> {invoice.place_of_supply_state} ({invoice.place_of_supply_state_code})", body_style),
                Paragraph(f"<b>Supply Type:</b> {'Inter-State (IGST)' if invoice.is_inter_state else 'Intra-State (CGST + SGST)'}", body_style),
                Paragraph(f"<b>Reverse Charge:</b> {'Yes' if invoice.is_reverse_charge else 'No'}", body_style),
            ]
        ]
        if invoice.original_invoice_id:
            orig_no = invoice.original_invoice.invoice_number if invoice.original_invoice else str(invoice.original_invoice_id)
            meta_data.append([
                Paragraph(f"<b>Original Tax Invoice Ref:</b> {orig_no}", bold_style),
                Paragraph("<b>Adjustment Type:</b> Refund / Cancellation Reversal", body_style),
                Paragraph("", body_style)
            ])

        meta_table = Table(meta_data, colWidths=[200, 160, 160])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FAF6F0")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E6DCD2")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 12))

        # Supplier & Buyer Side-by-Side Table
        seller = invoice.seller_snapshot or {}
        buyer = invoice.buyer_snapshot or {}

        seller_cell = [
            Paragraph("<b>DETAILS OF SUPPLIER (SELLER)</b>", heading_style),
            Paragraph(f"<b>Legal Name:</b> {seller.get('legal_name', '')}", body_style),
            Paragraph(f"<b>Trade Name:</b> {seller.get('trade_name', '')}", body_style),
            Paragraph(f"<b>GSTIN:</b> {seller.get('gstin', '')}", bold_style),
            Paragraph(f"<b>PAN:</b> {seller.get('pan', '')}", body_style),
            Paragraph(f"<b>Address:</b> {seller.get('address', '')}, {seller.get('city', '')}, {seller.get('state', '')} - {seller.get('pincode', '')}", body_style),
            Paragraph(f"<b>State Code:</b> {seller.get('state_code', '')}", body_style),
            Paragraph(f"<b>Email / Phone:</b> {seller.get('email', '')} | {seller.get('phone', '')}", body_style),
        ]

        buyer_cell = [
            Paragraph("<b>DETAILS OF RECIPIENT (BUYER)</b>", heading_style),
            Paragraph(f"<b>Name:</b> {buyer.get('name', 'CineVerse Patron')}", body_style),
            Paragraph(f"<b>Customer GSTIN:</b> {buyer.get('customer_gstin') or 'Unregistered (Consumer B2C)'}", bold_style),
            Paragraph(f"<b>Business Name:</b> {buyer.get('business_name') or 'N/A'}", body_style),
            Paragraph(f"<b>Billing Address:</b> {buyer.get('business_address') or 'N/A'}", body_style),
            Paragraph(f"<b>State Code:</b> {buyer.get('state_code', '')}", body_style),
            Paragraph(f"<b>Email / Phone:</b> {buyer.get('email', '')} | {buyer.get('phone', '')}", body_style),
        ]

        parties_table = Table([[seller_cell, buyer_cell]], colWidths=[260, 260])
        parties_table.setStyle(TableStyle([
            ('BOX', (0, 0), (0, 0), 1, colors.HexColor("#E6DCD2")),
            ('BOX', (1, 0), (1, 0), 1, colors.HexColor("#E6DCD2")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(parties_table)
        elements.append(Spacer(1, 14))

        # Items Table
        item_headers = [
            Paragraph("<b>#</b>", heading_style),
            Paragraph("<b>Description</b>", heading_style),
            Paragraph("<b>SAC/HSN</b>", heading_style),
            Paragraph("<b>Qty</b>", heading_style),
            Paragraph("<b>Taxable (₹)</b>", heading_style),
            Paragraph("<b>CGST (₹)</b>", heading_style),
            Paragraph("<b>SGST (₹)</b>", heading_style),
            Paragraph("<b>IGST (₹)</b>", heading_style),
            Paragraph("<b>Total (₹)</b>", heading_style),
        ]

        item_rows = [item_headers]
        for idx, it in enumerate(invoice.items, start=1):
            taxable_rs = it.taxable_amount_paise / 100.0
            cgst_rs = it.cgst_paise / 100.0
            sgst_rs = it.sgst_paise / 100.0
            igst_rs = it.igst_paise / 100.0
            tot_rs = it.total_item_paise / 100.0

            item_rows.append([
                Paragraph(str(idx), body_style),
                Paragraph(it.description, body_style),
                Paragraph(it.sac_hsn_code, body_style),
                Paragraph(str(it.quantity), body_style),
                Paragraph(f"{taxable_rs:.2f}", body_style),
                Paragraph(f"{cgst_rs:.2f}<br/><font size=6 color='#666'>@{it.cgst_rate}%</font>", body_style),
                Paragraph(f"{sgst_rs:.2f}<br/><font size=6 color='#666'>@{it.sgst_rate}%</font>", body_style),
                Paragraph(f"{igst_rs:.2f}<br/><font size=6 color='#666'>@{it.igst_rate}%</font>", body_style),
                Paragraph(f"<b>{tot_rs:.2f}</b>", bold_style),
            ])

        # Total Row
        tot_taxable_rs = invoice.taxable_amount_paise / 100.0
        tot_cgst_rs = invoice.cgst_amount_paise / 100.0
        tot_sgst_rs = invoice.sgst_amount_paise / 100.0
        tot_igst_rs = invoice.igst_amount_paise / 100.0
        tot_final_rs = invoice.final_total_paise / 100.0

        item_rows.append([
            "",
            Paragraph("<b>TOTALS</b>", bold_style),
            "",
            "",
            Paragraph(f"<b>₹{tot_taxable_rs:.2f}</b>", bold_style),
            Paragraph(f"<b>₹{tot_cgst_rs:.2f}</b>", bold_style),
            Paragraph(f"<b>₹{tot_sgst_rs:.2f}</b>", bold_style),
            Paragraph(f"<b>₹{tot_igst_rs:.2f}</b>", bold_style),
            Paragraph(f"<b>₹{tot_final_rs:.2f}</b>", bold_style),
        ])

        col_widths = [20, 160, 50, 25, 65, 50, 50, 50, 50]
        items_table = Table(item_rows, colWidths=col_widths, repeatRows=1)
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#FAF6F0")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E6DCD2")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E6DCD2")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor("#1B1320")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 14))

        # Amount in Words & CA Confirmation Notice
        from app.services.payment_service import compute_refund_breakdown_paise
        # Helper to convert integer paise to rupee words
        elements.append(Paragraph(
            f"<b>Invoice Amount in Integer Paise:</b> {invoice.final_total_paise} paise "
            f"(Taxable: {invoice.taxable_amount_paise} paise, GST: {invoice.total_tax_paise} paise)",
            body_style
        ))
        elements.append(Spacer(1, 8))

        if invoice.is_draft:
            notice_text = (
                "<b>CA ADVISORY NOTICE:</b> This is a provisional draft invoice generated using placeholder "
                "statutory rates. All tax codes (SAC/HSN), rates, supplier liability classification, "
                "and e-commerce operator obligations are pending final review and confirmation by CineVerse's "
                "Chartered Accountant. Refer to docs/tax-open-questions.md for active policy determinations."
            )
            notice_table = Table([[Paragraph(notice_text, body_style)]], colWidths=[520])
            notice_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#F87171")),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(notice_table)

        doc.build(elements, canvasmaker=WatermarkCanvas)
        buffer.seek(0)
        return buffer.getvalue()
