# backend/tests/test_operator_schedule.py
import pytest
import asyncio
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, and_, or_
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import AsyncSessionLocal, init_db
from app.models.auth import User, RoleEnum
from app.models.cinema import Cinema, Auditorium, Seat
from app.models.movie import Movie
from app.models.showtime import Showtime, PriceRule, SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingStatusEnum, BookingSeat
from app.models.payment import Refund
from app.models.dynamic_pricing import DynamicPricingRule, PricingRuleStatusEnum
from app.services.auth_service import create_access_token
from app.services.operator_schedule_service import OperatorScheduleService


@pytest.fixture(autouse=True)
async def setup_dbs():
    await init_db()


@pytest.mark.asyncio
async def test_screen_conflict_and_cleaning_buffer():
    """
    Test that overlapping slots on the same auditorium are detected,
    including the mandatory cleaning gap buffer.
    """
    async with AsyncSessionLocal() as db:
        # Fetch an auditorium and movie
        aud_res = await db.execute(select(Auditorium).limit(1))
        aud = aud_res.scalars().first()
        assert aud is not None

        mov_res = await db.execute(select(Movie).limit(1))
        mov = mov_res.scalars().first()
        assert mov is not None

        # Base slot: 10:00 to 12:00, with 20m cleaning gap (effective end: 12:20)
        base_start = datetime(2026, 12, 1, 10, 0, 0)
        base_end = datetime(2026, 12, 1, 12, 0, 0)
        gap = 20

        st = Showtime(
            movie_id=mov.id,
            auditorium_id=aud.id,
            cinema_id=aud.cinema_id,
            start_time=base_start,
            end_time=base_end,
            format="2D",
            language="English",
            status="SCHEDULED",
            cleaning_gap_minutes=gap
        )
        db.add(st)
        await db.commit()
        await db.refresh(st)

        try:
            # 1. Direct overlap (11:00 to 13:00) -> MUST conflict
            conflict1 = await OperatorScheduleService.detect_conflicts(
                db, aud.id, datetime(2026, 12, 1, 11, 0), datetime(2026, 12, 1, 13, 0), gap
            )
            assert conflict1 is not None
            assert conflict1["has_conflict"] is True
            assert conflict1["conflicting_showtime_id"] == st.id

            # 2. Overlap inside the 20-minute cleaning buffer (12:10 to 14:00) -> MUST conflict
            conflict2 = await OperatorScheduleService.detect_conflicts(
                db, aud.id, datetime(2026, 12, 1, 12, 10), datetime(2026, 12, 1, 14, 0), gap
            )
            assert conflict2 is not None
            assert conflict2["has_conflict"] is True

            # 3. Exactly at or after the cleaning buffer (12:20 onwards) -> NO conflict
            conflict3 = await OperatorScheduleService.detect_conflicts(
                db, aud.id, datetime(2026, 12, 1, 12, 20), datetime(2026, 12, 1, 14, 30), gap
            )
            assert conflict3 is None

            # 4. Another screen -> NO conflict
            other_aud_res = await db.execute(select(Auditorium).where(Auditorium.id != aud.id).limit(1))
            other_aud = other_aud_res.scalars().first()
            if other_aud:
                conflict_diff_screen = await OperatorScheduleService.detect_conflicts(
                    db, other_aud.id, datetime(2026, 12, 1, 10, 30), datetime(2026, 12, 1, 12, 30), gap
                )
                assert conflict_diff_screen is None
        finally:
            # Clean up
            await db.delete(st)
            await db.commit()


@pytest.mark.asyncio
async def test_bulk_copy_schedule_and_modes():
    """
    Test bulk copying a day's schedule to other dates with SKIP_CONFLICTS and FAIL_ON_CONFLICT modes.
    """
    async with AsyncSessionLocal() as db:
        aud_res = await db.execute(select(Auditorium).limit(1))
        aud = aud_res.scalars().first()
        mov_res = await db.execute(select(Movie).limit(1))
        mov = mov_res.scalars().first()

        admin_res = await db.execute(select(User).where(User.role == RoleEnum.ADMIN).limit(1))
        admin = admin_res.scalars().first()

        # Clean up any leftover 2028 shows from previous runs
        stale_shows = await db.execute(
            select(Showtime).where(Showtime.cinema_id == aud.cinema_id, Showtime.start_time >= datetime(2028, 1, 1))
        )
        for s in stale_shows.scalars().all():
            await db.delete(s)
        await db.commit()

        src_date = "2028-05-10"
        src_start = datetime(2028, 5, 10, 14, 0, 0)
        src_end = datetime(2028, 5, 10, 16, 30, 0)

        # Seed source show
        src_show = Showtime(
            movie_id=mov.id,
            auditorium_id=aud.id,
            cinema_id=aud.cinema_id,
            start_time=src_start,
            end_time=src_end,
            format="IMAX",
            language="English",
            status="SCHEDULED",
            cleaning_gap_minutes=20
        )
        db.add(src_show)
        await db.flush()

        db.add(PriceRule(showtime_id=src_show.id, category="Prime", base_price=450.0))
        db.add(PriceRule(showtime_id=src_show.id, category="Recliner", base_price=750.0))
        await db.commit()

        aud_cinema_id = int(aud.cinema_id)
        mov_id = int(mov.id)

        target_dates = ["2028-05-11", "2028-05-12"]

        try:
            # Bulk copy to target dates
            res = await OperatorScheduleService.bulk_copy_schedule(
                db=db,
                user=admin,
                cinema_id=aud_cinema_id,
                source_date=src_date,
                target_dates=target_dates,
                copy_mode="SKIP_CONFLICTS"
            )
            assert res["total_copied"] == 2
            assert res["total_skipped"] == 0

            # Verify copied shows on 2028-05-11
            target_dt = datetime(2028, 5, 11, 14, 0, 0)
            copied_res = await db.execute(
                select(Showtime).where(
                    Showtime.cinema_id == aud_cinema_id,
                    Showtime.start_time == target_dt
                )
            )
            copied = copied_res.scalars().first()
            assert copied is not None
            assert copied.format == "IMAX"

            # Test FAIL_ON_CONFLICT mode when a slot already exists
            with pytest.raises(Exception) as exc_info:
                await OperatorScheduleService.bulk_copy_schedule(
                    db=db,
                    user=admin,
                    cinema_id=aud_cinema_id,
                    source_date=src_date,
                    target_dates=["2028-05-11"],
                    copy_mode="FAIL_ON_CONFLICT"
                )
            assert "conflict" in str(exc_info.value).lower()
        finally:
            # Clean up
            all_shows = await db.execute(
                select(Showtime).where(Showtime.cinema_id == aud_cinema_id, Showtime.movie_id == mov_id)
            )
            for s in all_shows.scalars().all():
                if s.start_time.strftime("%Y-%m-%d") in ["2028-05-10", "2028-05-11", "2028-05-12"]:
                    await db.delete(s)
            await db.commit()


@pytest.mark.asyncio
async def test_csv_import_with_bad_rows_and_preview():
    """
    Test CSV row-by-row validation: catches invalid cinemas, missing movies,
    bad datetime strings, and negative pricing.
    """
    async with AsyncSessionLocal() as db:
        admin_res = await db.execute(select(User).where(User.role == RoleEnum.ADMIN).limit(1))
        admin = admin_res.scalars().first()

        cin_res = await db.execute(select(Cinema).limit(1))
        cinema = cin_res.scalars().first()
        aud_res = await db.execute(select(Auditorium).where(Auditorium.cinema_id == cinema.id).limit(1))
        aud = aud_res.scalars().first()
        mov_res = await db.execute(select(Movie).limit(1))
        mov = mov_res.scalars().first()

        # CSV with 1 valid row and 3 intentionally broken rows
        csv_content = f"""cinema_name,hall_name,movie_title,start_time,format,language,front_price,prime_price,recliner_price
{cinema.name},{aud.name},{mov.title},2026-12-15 14:00,2D,English,200,350,600
NonExistentCinema,{aud.name},{mov.title},2026-12-15 17:00,2D,English,200,350,600
{cinema.name},{aud.name},NonExistentMovieTitle,2026-12-15 20:00,2D,English,200,350,600
{cinema.name},{aud.name},{mov.title},NOT_A_VALID_DATE,2D,English,200,-50,600
"""
        report = await OperatorScheduleService.parse_and_validate_csv(
            db=db,
            csv_text=csv_content,
            entity_type="SHOWTIMES",
            user=admin
        )

        assert report["total_rows"] == 4
        assert report["valid_rows_count"] == 1
        assert report["invalid_rows_count"] == 3
        assert report["is_valid"] is False

        errors = report["error_report"]
        # Row 3 (index 3 in file): NonExistentCinema
        assert any(e["row"] == 3 and "cinema" in e["error"].lower() for e in errors)
        # Row 4 (index 4 in file): NonExistentMovieTitle
        assert any(e["row"] == 4 and "movie" in e["error"].lower() for e in errors)
        # Row 5 (index 5 in file): NOT_A_VALID_DATE and negative price
        assert any(e["row"] == 5 and "datetime" in e["error"].lower() for e in errors)
        assert any(e["row"] == 5 and "positive" in e["error"].lower() for e in errors)


@pytest.mark.asyncio
async def test_csv_import_and_clean_undo():
    """
    Test executing a verified CSV import and subsequently performing a clean transactional undo.
    """
    async with AsyncSessionLocal() as db:
        admin_res = await db.execute(select(User).where(User.role == RoleEnum.ADMIN).limit(1))
        admin = admin_res.scalars().first()

        cin_res = await db.execute(select(Cinema).limit(1))
        cinema = cin_res.scalars().first()
        aud_res = await db.execute(select(Auditorium).where(Auditorium.cinema_id == cinema.id).limit(1))
        aud = aud_res.scalars().first()
        mov_res = await db.execute(select(Movie).limit(1))
        mov = mov_res.scalars().first()

        csv_valid = f"""cinema_name,hall_name,movie_title,start_time,format,language,front_price,prime_price,recliner_price
{cinema.name},{aud.name},{mov.title},2026-12-25 09:00,2D,English,220,380,650
{cinema.name},{aud.name},{mov.title},2026-12-25 15:00,2D,English,220,380,650
"""
        # Execute import
        import_res = await OperatorScheduleService.execute_csv_import(
            db=db,
            csv_text=csv_valid,
            entity_type="SHOWTIMES",
            user=admin,
            filename="christmas_special.csv"
        )
        assert import_res["success"] is True
        batch_id = import_res["batch_id"]
        created_st_ids = import_res["created_ids"]["showtime_ids"]
        assert len(created_st_ids) == 2

        # Verify showtimes are in DB
        check_st = await db.execute(select(Showtime).where(Showtime.id.in_(created_st_ids)))
        assert len(check_st.scalars().all()) == 2

        # Undo the import batch
        undo_res = await OperatorScheduleService.undo_import_batch(
            db=db,
            batch_id=batch_id,
            user=admin
        )
        assert undo_res["success"] is True
        assert undo_res["deleted_showtimes_count"] == 2

        # Verify showtimes and inventory are completely removed
        check_st2 = await db.execute(select(Showtime).where(Showtime.id.in_(created_st_ids)))
        assert len(check_st2.scalars().all()) == 0

        check_inv = await db.execute(select(SeatInventory).where(SeatInventory.showtime_id.in_(created_st_ids)))
        assert len(check_inv.scalars().all()) == 0


@pytest.mark.asyncio
async def test_cinema_manager_scope_enforcement():
    """
    Test that a Cinema Manager is strictly scoped to their assigned cinema_id
    and cannot view, schedule, or modify shows in other cinemas.
    """
    async with AsyncSessionLocal() as db:
        # Get two distinct cinemas
        cin_res = await db.execute(select(Cinema).order_by(Cinema.id).limit(2))
        cinemas = cin_res.scalars().all()
        assert len(cinemas) >= 2
        cin1, cin2 = cinemas[0], cinemas[1]

        # Create or fetch a cinema manager assigned to cin1
        manager_res = await db.execute(
            select(User).where(User.role == RoleEnum.CINEMA_MANAGER, User.cinema_id == cin1.id)
        )
        manager = manager_res.scalars().first()
        if not manager:
            manager = User(
                email=f"scope_mgr_{uuid.uuid4().hex[:6]}@cineverse.com",
                role=RoleEnum.CINEMA_MANAGER,
                cinema_id=cin1.id,
                full_name="Cinema 1 Scope Manager"
            )
            db.add(manager)
            await db.commit()
            await db.refresh(manager)

        # 1. Manager accessing cin1 -> OK
        OperatorScheduleService.validate_manager_scope(manager, cin1.id)

        # 2. Manager accessing cin2 -> 403 Forbidden
        with pytest.raises(Exception) as exc_info:
            OperatorScheduleService.validate_manager_scope(manager, cin2.id)
        assert "403" in str(exc_info.value) or "denied" in str(exc_info.value).lower()

        # 3. Admin accessing both -> OK
        admin_res = await db.execute(select(User).where(User.role == RoleEnum.ADMIN).limit(1))
        admin = admin_res.scalars().first()
        OperatorScheduleService.validate_manager_scope(admin, cin1.id)
        OperatorScheduleService.validate_manager_scope(admin, cin2.id)


@pytest.mark.asyncio
async def test_seat_price_map_preview_equivalence():
    """
    Test that operator seat price map preview matches customer pricing logic
    including base rules and dynamic pricing floor/ceiling bounds.
    """
    async with AsyncSessionLocal() as db:
        admin_res = await db.execute(select(User).where(User.role == RoleEnum.ADMIN).limit(1))
        admin = admin_res.scalars().first()

        aud_res = await db.execute(select(Auditorium).limit(1))
        aud = aud_res.scalars().first()
        mov_res = await db.execute(select(Movie).limit(1))
        mov = mov_res.scalars().first()

        st = Showtime(
            movie_id=mov.id,
            auditorium_id=aud.id,
            cinema_id=aud.cinema_id,
            start_time=datetime(2026, 12, 20, 18, 0),
            end_time=datetime(2026, 12, 20, 20, 30),
            format="2D",
            language="English",
            status="SCHEDULED"
        )
        db.add(st)
        await db.flush()

        db.add(PriceRule(showtime_id=st.id, category="Prime", base_price=300.0))
        db.add(PriceRule(showtime_id=st.id, category="Recliner", base_price=500.0))

        # Add active dynamic pricing rule with floor 350 and ceiling 400 for Prime
        dyn_rule = DynamicPricingRule(
            name="Prime Surge",
            cinema_id=aud.cinema_id,
            category="Prime",
            price_multiplier=1.5,  # 300 * 1.5 = 450 -> capped at ceiling 400
            flat_adjustment=0.0,
            floor_price=250.0,
            ceiling_price=400.0,
            version=1,
            status=PricingRuleStatusEnum.ACTIVE
        )
        db.add(dyn_rule)
        await db.commit()

        try:
            preview = await OperatorScheduleService.get_seat_price_map_preview(db, st.id, admin)
            assert preview["showtime_id"] == st.id
            assert preview["total_seats"] > 0

            # Check that Prime seats have effective_price of exactly 400.0 (capped at ceiling)
            prime_seats = [s for s in preview["seat_map"] if s["category"] == "Prime"]
            if prime_seats:
                assert prime_seats[0]["base_price"] == 300.0
                assert prime_seats[0]["effective_price"] == 400.0
                assert prime_seats[0]["effective_price_paise"] == 40000
        finally:
            await db.delete(dyn_rule)
            await db.delete(st)
            await db.commit()


@pytest.mark.asyncio
async def test_show_cancellation_dry_run_vs_real_run():
    """
    Test show cancellation:
    1. Dry run returns affected bookings, tickets, and 100% full refund in paise WITHOUT mutating state.
    2. Real run validates MFA, updates status to CANCELLED, issues 100% full refunds,
       notifies customers, and releases seat inventory.
    3. Idempotent duplicate call returns previous summary without double-refunding.
    """
    async with AsyncSessionLocal() as db:
        admin_res = await db.execute(select(User).where(User.role == RoleEnum.ADMIN).limit(1))
        admin = admin_res.scalars().first()

        aud_res = await db.execute(select(Auditorium).limit(1))
        aud = aud_res.scalars().first()
        mov_res = await db.execute(select(Movie).limit(1))
        mov = mov_res.scalars().first()
        customer_res = await db.execute(select(User).where(User.role == RoleEnum.CUSTOMER).limit(1))
        customer = customer_res.scalars().first()

        st = Showtime(
            movie_id=mov.id,
            auditorium_id=aud.id,
            cinema_id=aud.cinema_id,
            start_time=datetime(2026, 12, 31, 21, 0),
            end_time=datetime(2026, 12, 31, 23, 30),
            format="2D",
            language="English",
            status="SCHEDULED"
        )
        db.add(st)
        await db.flush()

        # Add seat inventory
        inv1 = SeatInventory(showtime_id=st.id, seat_id="A1", category="Prime", status=SeatStatusEnum.BOOKED, price=300.0)
        inv2 = SeatInventory(showtime_id=st.id, seat_id="A2", category="Prime", status=SeatStatusEnum.BOOKED, price=300.0)
        db.add_all([inv1, inv2])

        # Add booking
        booking = Booking(
            booking_code=f"OP-CANCEL-{uuid.uuid4().hex[:6].upper()}",
            user_id=customer.id,
            showtime_id=st.id,
            total_ticket_amount=600.0,
            convenience_fee=50.0,
            gst_amount=9.0,
            final_total_amount=659.0,
            status=BookingStatusEnum.CONFIRMED,
            contact_email="test_patron@cineverse.com",
            contact_phone="9876543210"
        )
        db.add(booking)
        await db.flush()

        db.add(BookingSeat(booking_id=booking.id, showtime_id=st.id, seat_id="A1", category="Prime", price=300.0))
        db.add(BookingSeat(booking_id=booking.id, showtime_id=st.id, seat_id="A2", category="Prime", price=300.0))
        await db.commit()

        try:
            # Step 1: DRY RUN
            dry_run = await OperatorScheduleService.dry_run_cancel_show(db, st.id, admin)
            assert dry_run["dry_run"] is True
            assert dry_run["affected_bookings_count"] == 1
            assert dry_run["affected_tickets_count"] == 2
            assert dry_run["total_refund_paise"] == 65900  # ₹659.00 * 100
            assert dry_run["total_refund_rupees"] == 659.0

            # Verify no mutation occurred
            check_st = await db.execute(select(Showtime).where(Showtime.id == st.id))
            assert check_st.scalars().first().status == "SCHEDULED"

            check_bk = await db.execute(select(Booking).where(Booking.id == booking.id))
            assert check_bk.scalars().first().status == BookingStatusEnum.CONFIRMED

            # Step 2: Invalid MFA rejected
            with pytest.raises(Exception) as exc_info:
                await OperatorScheduleService.execute_cancel_show(
                    db, st.id, admin, mfa_code="WRONG_CODE", reason="Emergency maintenance"
                )
            assert "401" in str(exc_info.value) or "mfa" in str(exc_info.value).lower()

            # Step 3: REAL RUN with valid MFA
            real_run = await OperatorScheduleService.execute_cancel_show(
                db, st.id, admin, mfa_code="MFA-123456", reason="Emergency maintenance"
            )
            assert real_run["success"] is True
            assert real_run["status"] == "CANCELLED"
            assert real_run["refunded_bookings_count"] == 1
            assert real_run["total_refund_paise"] == 65900

            # Verify DB state updated
            await db.refresh(st)
            assert st.status == "CANCELLED"
            assert st.cancellation_reason == "Emergency maintenance"

            await db.refresh(booking)
            assert booking.status == BookingStatusEnum.CANCELLED

            # Verify Refund record
            rfnd_res = await db.execute(select(Refund).where(Refund.booking_id == booking.id))
            rfnd = rfnd_res.scalars().first()
            assert rfnd is not None
            assert rfnd.amount_paise == 65900
            assert rfnd.cancellation_fee_paise == 0  # 100% full refund

            # Verify seat inventory released
            await db.refresh(inv1)
            await db.refresh(inv2)
            assert inv1.status == SeatStatusEnum.AVAILABLE
            assert inv2.status == SeatStatusEnum.AVAILABLE

            # Step 4: IDEMPOTENCY CHECK
            idempotent_run = await OperatorScheduleService.execute_cancel_show(
                db, st.id, admin, mfa_code="MFA-123456", reason="Duplicate request"
            )
            assert idempotent_run.get("idempotent_duplicate") is True
            assert idempotent_run["status"] == "CANCELLED"

        finally:
            # Clean up
            from app.models.tax import Invoice, InvoiceItem
            from sqlalchemy import delete
            inv_res = await db.execute(select(Invoice).where(Invoice.booking_id == booking.id))
            for inv in inv_res.scalars().all():
                await db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
                await db.delete(inv)
            rfnd_res = await db.execute(select(Refund).where(Refund.booking_id == booking.id))
            for rf in rfnd_res.scalars().all():
                await db.delete(rf)
            await db.delete(booking)
            await db.delete(st)
            await db.commit()
