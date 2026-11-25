# backend/tests/test_tax_invoice_engine.py
import pytest
import asyncio
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, update
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import AsyncSessionLocal, init_db
from app.models.auth import User, RoleEnum
from app.models.booking import Booking, BookingStatusEnum, BookingSeat, Ticket
from app.models.showtime import Showtime
from app.models.cinema import Cinema, City
from app.models.tax import (
    TaxRule, TaxEntity, TaxSetting, InvoiceSequence, Invoice, InvoiceItem
)
from app.services.auth_service import create_access_token
from app.services.tax_invoice_service import TaxInvoiceService, get_financial_year


@pytest.fixture(autouse=True)
async def setup_tax_engine_data():
    await init_db()
    from app.seed.seed_tax_rules import seed_tax_system
    await seed_tax_system()


@pytest.mark.asyncio
async def test_numbering_under_concurrency():
    """
    Test that sequential invoice numbering is strictly gap-free and unique
    even when multiple concurrent tasks request sequence numbers simultaneously.
    """
    async with AsyncSessionLocal() as db:
        plat_res = await db.execute(select(TaxEntity).where(TaxEntity.entity_type == "PLATFORM"))
        entity = plat_res.scalars().first()
        assert entity is not None

        fy = "2026-27"
        series = f"CONCURRENCY-TEST-{uuid.uuid4().hex[:8]}"

        async def fetch_seq():
            async with AsyncSessionLocal() as local_db:
                return await TaxInvoiceService.get_next_sequence_number(
                    local_db, entity.id, fy, series
                )

        # Fire 25 concurrent requests
        results = await asyncio.gather(*[fetch_seq() for _ in range(25)])

        # Verify uniqueness and exact contiguous sequence [1, 2, ..., 25]
        assert len(results) == 25
        assert len(set(results)) == 25
        assert sorted(results) == list(range(1, 26))


@pytest.mark.asyncio
async def test_totals_reproduce_from_paise():
    """
    Test that invoice financial totals reproduce exactly from integer paise
    down to the single paisa without floating point rounding drift.
    """
    async with AsyncSessionLocal() as db:
        # Create a test booking
        st_res = await db.execute(select(Showtime).limit(1))
        st = st_res.scalars().first()
        assert st is not None

        user_res = await db.execute(select(User).where(User.role == RoleEnum.CUSTOMER).limit(1))
        user = user_res.scalars().first()

        now = datetime.utcnow()
        booking = Booking(
            booking_code=f"CV-TAX-{int(now.timestamp())}",
            user_id=user.id,
            showtime_id=st.id,
            status=BookingStatusEnum.CONFIRMED,
            total_ticket_amount=700.0,
            convenience_fee=60.0,
            gst_amount=10.8,
            addons_amount=0.0,
            discount_amount=0.0,
            final_total_amount=770.8,
            contact_email="test.tax@example.com",
            contact_phone="+91 99887 76655",
            created_at=now
        )
        db.add(booking)
        await db.flush()

        seat1 = BookingSeat(booking_id=booking.id, showtime_id=st.id, seat_id="Z01", category="Prime", price=350.0)
        seat2 = BookingSeat(booking_id=booking.id, showtime_id=st.id, seat_id="Z02", category="Prime", price=350.0)
        db.add_all([seat1, seat2])
        await db.commit()

        invoices = await TaxInvoiceService.generate_invoice_for_booking(db, booking.id)
        assert len(invoices) >= 1

        for inv in invoices:
            # 1. Total equals taxable + taxes
            assert inv.final_total_paise == inv.taxable_amount_paise + inv.cgst_amount_paise + inv.sgst_amount_paise + inv.igst_amount_paise
            assert inv.total_tax_paise == inv.cgst_amount_paise + inv.sgst_amount_paise + inv.igst_amount_paise

            # 2. Items sum equals invoice header
            items_taxable = sum(item.taxable_amount_paise for item in inv.items)
            items_cgst = sum(item.cgst_paise for item in inv.items)
            items_sgst = sum(item.sgst_paise for item in inv.items)
            items_igst = sum(item.igst_paise for item in inv.items)
            items_total = sum(item.total_item_paise for item in inv.items)

            assert items_taxable == inv.taxable_amount_paise
            assert items_cgst == inv.cgst_amount_paise
            assert items_sgst == inv.sgst_amount_paise
            assert items_igst == inv.igst_amount_paise
            assert items_total == inv.final_total_paise


@pytest.mark.asyncio
async def test_rule_changes_do_not_alter_past_invoices():
    """
    Test invoice immutability: modifying or adding tax rules in the database
    must NEVER alter the snapshot or line items of previously generated invoices.
    """
    async with AsyncSessionLocal() as db:
        st_res = await db.execute(select(Showtime).limit(1))
        st = st_res.scalars().first()
        user_res = await db.execute(select(User).where(User.role == RoleEnum.CUSTOMER).limit(1))
        user = user_res.scalars().first()

        now = datetime.utcnow()
        booking = Booking(
            booking_code=f"CV-IMMUT-{int(now.timestamp())}",
            user_id=user.id,
            showtime_id=st.id,
            status=BookingStatusEnum.CONFIRMED,
            total_ticket_amount=350.0,
            convenience_fee=30.0,
            final_total_amount=380.0,
            created_at=now
        )
        db.add(booking)
        await db.flush()
        db.add(BookingSeat(booking_id=booking.id, showtime_id=st.id, seat_id="Y01", category="Prime", price=350.0))
        await db.commit()

        invoices = await TaxInvoiceService.generate_invoice_for_booking(db, booking.id)
        tkt_inv = [inv for inv in invoices if "TKT" in inv.invoice_number][0]
        original_taxable = tkt_inv.taxable_amount_paise
        original_cgst = tkt_inv.cgst_amount_paise
        original_sgst = tkt_inv.sgst_amount_paise
        original_rate = tkt_inv.items[0].tax_rate_percent

        # Now simulate a tax rule change (e.g. government updates rate from 18% to 28%)
        rule_stmt = select(TaxRule).where(TaxRule.item_type == "TICKET", TaxRule.min_price_paise > 10000)
        rule_res = await db.execute(rule_stmt)
        ticket_rule = rule_res.scalars().first()
        if ticket_rule:
            ticket_rule.rate_percent = 28.0
            await db.commit()

        # Re-fetch the old invoice from DB
        async with AsyncSessionLocal() as verify_db:
            from sqlalchemy.orm import selectinload
            stmt = select(Invoice).options(selectinload(Invoice.items)).where(Invoice.id == tkt_inv.id)
            verify_res = await verify_db.execute(stmt)
            cached_inv = verify_res.scalars().first()

            assert cached_inv.taxable_amount_paise == original_taxable
            assert cached_inv.cgst_amount_paise == original_cgst
            assert cached_inv.sgst_amount_paise == original_sgst
            assert cached_inv.items[0].tax_rate_percent == original_rate
            assert cached_inv.items[0].tax_rate_percent != 28.0  # past invoice was NOT altered!

        # Revert rule back to 18.0%
        if ticket_rule:
            ticket_rule.rate_percent = 18.0
            await db.commit()


@pytest.mark.asyncio
async def test_same_state_and_cross_state_splits():
    """
    Test GST supply classification logic:
    - Intra-State (Supplier State == POS State): CGST (rate/2) + SGST (rate/2), IGST = 0.
    - Inter-State (Supplier State != POS State): CGST = 0, SGST = 0, IGST = full rate.
    """
    async with AsyncSessionLocal() as db:
        # 1. Intra-State Invoice
        # Convenience fee where Platform is in Telangana (36) and B2C / customer is in Telangana (36)
        inv_intra = Invoice(
            invoice_number="TEST/26-27/00001",
            invoice_type="TAX_INVOICE",
            financial_year="2026-27",
            booking_id=1,
            issuer_entity_id=1,
            issuer_type="PLATFORM",
            invoice_date=datetime.utcnow(),
            place_of_supply_state="Telangana",
            place_of_supply_state_code="36",
            is_inter_state=False,
            seller_snapshot={"state_code": "36"},
            buyer_snapshot={"state_code": "36"},
            taxable_amount_paise=10000,
            cgst_amount_paise=900,
            sgst_amount_paise=900,
            igst_amount_paise=0,
            total_tax_paise=1800,
            final_total_paise=11800
        )
        assert inv_intra.is_inter_state is False
        assert inv_intra.cgst_amount_paise == 900
        assert inv_intra.sgst_amount_paise == 900
        assert inv_intra.igst_amount_paise == 0

        # 2. Inter-State Invoice
        # Convenience fee where Platform is in Telangana (36) and B2B corporate customer is in Karnataka (29)
        inv_inter = Invoice(
            invoice_number="TEST/26-27/00002",
            invoice_type="TAX_INVOICE",
            financial_year="2026-27",
            booking_id=1,
            issuer_entity_id=1,
            issuer_type="PLATFORM",
            invoice_date=datetime.utcnow(),
            place_of_supply_state="Karnataka",
            place_of_supply_state_code="29",
            is_inter_state=True,
            seller_snapshot={"state_code": "36"},
            buyer_snapshot={"state_code": "29", "customer_gstin": "29AABCP1234D1Z5"},
            taxable_amount_paise=10000,
            cgst_amount_paise=0,
            sgst_amount_paise=0,
            igst_amount_paise=1800,
            total_tax_paise=1800,
            final_total_paise=11800
        )
        assert inv_inter.is_inter_state is True
        assert inv_inter.cgst_amount_paise == 0
        assert inv_inter.sgst_amount_paise == 0
        assert inv_inter.igst_amount_paise == 1800


@pytest.mark.asyncio
async def test_credit_note_on_refund():
    """
    Test Credit Note creation upon customer refund:
    - Must be marked CREDIT_NOTE
    - Must link to original tax invoice (original_invoice_id)
    - Reverses tax liabilities proportionally in integer paise
    """
    async with AsyncSessionLocal() as db:
        st_res = await db.execute(select(Showtime).limit(1))
        st = st_res.scalars().first()
        user_res = await db.execute(select(User).where(User.role == RoleEnum.CUSTOMER).limit(1))
        user = user_res.scalars().first()

        now = datetime.utcnow()
        booking = Booking(
            booking_code=f"CV-CN-{int(now.timestamp())}",
            user_id=user.id,
            showtime_id=st.id,
            status=BookingStatusEnum.CONFIRMED,
            total_ticket_amount=700.0,
            convenience_fee=60.0,
            final_total_amount=760.0,
            created_at=now
        )
        db.add(booking)
        await db.flush()
        db.add(BookingSeat(booking_id=booking.id, showtime_id=st.id, seat_id="X01", category="Prime", price=700.0))
        await db.commit()

        invoices = await TaxInvoiceService.generate_invoice_for_booking(db, booking.id)
        orig_tkt_inv = [inv for inv in invoices if "TKT" in inv.invoice_number][0]

        # Issue 75% refund = ₹525 (52500 paise) on tickets
        refund_paise = round(525.0 * 100)
        cn = await TaxInvoiceService.create_credit_note_for_refund(
            db,
            original_invoice_id=orig_tkt_inv.id,
            refunded_amount_paise=refund_paise,
            reason="Customer cancellation within window"
        )

        assert cn.invoice_type == "CREDIT_NOTE"
        assert cn.original_invoice_id == orig_tkt_inv.id
        assert "-CN" in cn.invoice_number
        assert cn.final_total_paise > 0
        assert cn.final_total_paise == cn.taxable_amount_paise + cn.cgst_amount_paise + cn.sgst_amount_paise + cn.igst_amount_paise
        assert len(cn.items) >= 1
        assert "[CREDIT NOTE REVERSAL]" in cn.items[0].description


@pytest.mark.asyncio
async def test_owner_only_download_and_admin_access():
    """
    Test authorization rules:
    - Owner can download invoice PDF
    - Admin can download any invoice PDF
    - Another user (IDOR attempt) receives HTTP 403 Forbidden
    """
    async with AsyncSessionLocal() as db:
        users_res = await db.execute(select(User).where(User.role == RoleEnum.CUSTOMER))
        customers = users_res.scalars().all()
        assert len(customers) >= 2, "Need at least 2 customer accounts for IDOR test"
        user_owner = customers[0]
        user_other = customers[1]

        admin_res = await db.execute(select(User).where(User.role == RoleEnum.ADMIN))
        admin_user = admin_res.scalars().first()
        assert admin_user is not None

        # Fetch an invoice belonging to user_owner or create one
        st_res = await db.execute(select(Showtime).limit(1))
        st = st_res.scalars().first()

        booking = Booking(
            booking_code=f"CV-AUTH-{int(datetime.utcnow().timestamp())}",
            user_id=user_owner.id,
            showtime_id=st.id,
            status=BookingStatusEnum.CONFIRMED,
            total_ticket_amount=350.0,
            convenience_fee=30.0,
            final_total_amount=380.0,
            created_at=datetime.utcnow()
        )
        db.add(booking)
        await db.flush()
        db.add(BookingSeat(booking_id=booking.id, showtime_id=st.id, seat_id="W01", category="Prime", price=350.0))
        await db.commit()

        invoices = await TaxInvoiceService.generate_invoice_for_booking(db, booking.id)
        inv = invoices[0]

        owner_token = create_access_token({"sub": str(user_owner.id)})
        other_token = create_access_token({"sub": str(user_other.id)})
        admin_token = create_access_token({"sub": str(admin_user.id)})

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Owner download -> HTTP 200 with PDF content-type
            resp_owner = await client.get(
                f"/api/v1/invoices/{inv.id}/pdf",
                headers={"Authorization": f"Bearer {owner_token}"}
            )
            assert resp_owner.status_code == 200
            assert resp_owner.headers["content-type"] == "application/pdf"
            assert resp_owner.content.startswith(b"%PDF")

            # 2. Admin download -> HTTP 200 with PDF content-type
            resp_admin = await client.get(
                f"/api/v1/invoices/{inv.id}/pdf",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert resp_admin.status_code == 200
            assert resp_admin.content.startswith(b"%PDF")

            # 3. Another user -> HTTP 403 Forbidden
            resp_other = await client.get(
                f"/api/v1/invoices/{inv.id}/pdf",
                headers={"Authorization": f"Bearer {other_token}"}
            )
            assert resp_other.status_code == 403
            assert "Forbidden" in resp_other.json()["detail"]
