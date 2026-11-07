import json
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy import select, update

from app.database import AsyncSessionLocal
from app.models.auth import User, RoleEnum
from app.models.cinema import Cinema, Auditorium, Seat
from app.models.booking import Booking, BookingStatusEnum
from app.models.showtime import Showtime
from app.models.operations import LoyaltyAccount, LoyaltyLedger, LoyaltyTierEnum
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_designer_validate_endpoint(client: AsyncClient):
    admin_token = create_access_token({"sub": "1", "email": "admin@cineverse.com", "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Valid layout (2 rows x 12 seats = 24 seats, aisle at 6, wheelchair seat included)
    valid_payload = {
        "auditorium_id": 1,
        "name": "Screen 1 Custom",
        "rows": ["A", "B"],
        "seats_per_row": 12,
        "aisles": [6],
        "aisle_width_m": 1.4,
        "wheelchair_seats": ["A01"],
        "companion_seats": ["A02"],
        "numbering_direction": "LEFT_TO_RIGHT",
        "screen_size": "CURVED_LARGE"
    }

    resp = await client.post(
        "/api/v1/admin/onboarding/designer/validate",
        json=valid_payload,
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True
    assert len(data["errors"]) == 0
    assert data["total_seats"] == 24
    assert data["wheelchair_seats_count"] == 1

    # 2. Too few seats (< 20)
    small_payload = dict(valid_payload)
    small_payload["rows"] = ["A"]
    small_payload["seats_per_row"] = 10
    resp_small = await client.post(
        "/api/v1/admin/onboarding/designer/validate",
        json=small_payload,
        headers=headers
    )
    assert resp_small.status_code == 200
    data_small = resp_small.json()
    assert data_small["is_valid"] is False
    assert any("at least 20 seats" in e for e in data_small["errors"])

    # 3. Fire egress violation (> 16 contiguous seats without aisle)
    no_aisle_payload = dict(valid_payload)
    no_aisle_payload["rows"] = ["A", "B"]
    no_aisle_payload["seats_per_row"] = 22
    no_aisle_payload["aisles"] = []
    resp_egress = await client.post(
        "/api/v1/admin/onboarding/designer/validate",
        json=no_aisle_payload,
        headers=headers
    )
    assert resp_egress.status_code == 200
    data_egress = resp_egress.json()
    assert data_egress["is_valid"] is False
    assert any("exceeds maximum 16-seat egress standard" in e for e in data_egress["errors"])

    # 4. Accessible seating missing when capacity >= 40
    no_wheelchair_payload = dict(valid_payload)
    no_wheelchair_payload["rows"] = ["A", "B", "C", "D"]
    no_wheelchair_payload["seats_per_row"] = 12
    no_wheelchair_payload["wheelchair_seats"] = []
    resp_wheelchair = await client.post(
        "/api/v1/admin/onboarding/designer/validate",
        json=no_wheelchair_payload,
        headers=headers
    )
    assert resp_wheelchair.status_code == 200
    data_wc = resp_wheelchair.json()
    assert data_wc["is_valid"] is False
    assert any("must include at least 1 wheelchair space" in e for e in data_wc["errors"])


@pytest.mark.asyncio
async def test_publish_safety_blocks_active_shows(client: AsyncClient):
    admin_token = create_access_token({"sub": "1", "email": "admin@cineverse.com", "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    async with AsyncSessionLocal() as db:
        audi = Auditorium(
            cinema_id=1,
            name="Publish Guard Audi 2",
            screen_type="Standard",
            total_seats=2,
            has_3d_preview=False
        )
        db.add(audi)
        await db.flush()

        show = Showtime(
            movie_id=1,
            cinema_id=1,
            auditorium_id=audi.id,
            start_time=datetime.utcnow() + timedelta(hours=3),
            end_time=datetime.utcnow() + timedelta(hours=5),
            format="2D",
            language="English"
        )
        db.add(show)
        await db.flush()

        booking = Booking(
            user_id=1,
            showtime_id=show.id,
            booking_code="PB-SAFE-1",
            final_total_amount=500.0,
            status=BookingStatusEnum.CONFIRMED
        )
        db.add(booking)
        await db.commit()
        audi_id = audi.id

    sample_layout = {
        "version": "2.1",
        "seats": [
            {"seat_id": "A01", "row": "A", "number": 1, "category": "Prime"},
            {"seat_id": "A02", "row": "A", "number": 2, "category": "Prime"}
        ]
    }

    # Attempt to publish layout changes to an auditorium with active confirmed bookings
    resp = await client.post(
        f"/api/v1/admin/onboarding/publish?auditorium_id={audi_id}",
        data={"version_label": "2.1", "seat_layout_json": json.dumps(sample_layout)},
        headers=headers
    )
    assert resp.status_code == 409
    assert "Modifying seat maps of booked shows is strictly prohibited" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_loyalty_redemption_and_balance_invariant(client: AsyncClient):
    user_token = create_access_token({"sub": "3", "email": "patron@example.com", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {user_token}"}

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(LoyaltyAccount).where(LoyaltyAccount.user_id == 3))
        acc = res.scalars().first()
        if not acc:
            acc = LoyaltyAccount(
                user_id=3,
                points_balance=250,
                total_lifetime_points=500,
                tier=LoyaltyTierEnum.SILVER,
                referral_code="CINE0003LOYAL"
            )
            db.add(acc)
        else:
            acc.points_balance = 250
        await db.commit()

    # 1. Redeem valid amount
    resp = await client.post(
        "/api/v1/loyalty/redeem",
        json={"points_to_redeem": 100},
        headers=headers
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "success"
    assert res_data["points_redeemed"] == 100
    assert res_data["remaining_points"] == 150

    # 2. Reject excessive redemption (balance cannot go negative)
    resp_over = await client.post(
        "/api/v1/loyalty/redeem",
        json={"points_to_redeem": 200},
        headers=headers
    )
    assert resp_over.status_code == 400
    assert "Insufficient loyalty points" in resp_over.json()["detail"]


@pytest.mark.asyncio
async def test_admin_operations_dashboard_and_manager_scoping(client: AsyncClient):
    # Setup manager user with cinema_id = 1
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(User)
            .where(User.id == 2)
            .values(cinema_id=1, role=RoleEnum.CINEMA_MANAGER)
        )
        await db.commit()

    manager_token = create_access_token({
        "sub": "2",
        "email": "manager@cineverse.com",
        "role": "CINEMA_MANAGER"
    })
    headers = {"Authorization": f"Bearer {manager_token}"}

    # 1. Fetch dashboard for authorized cinema (cinema_id=1)
    resp = await client.get("/api/v1/admin/operations/dashboard?cinema_id=1", headers=headers)
    assert resp.status_code == 200
    dash = resp.json()
    assert "date" in dash
    assert dash["cinema_id"] == 1
    assert "total_shows" in dash
    assert "shows" in dash

    # 2. Manager forbidden from viewing cinema 2
    forbidden_resp = await client.get("/api/v1/admin/operations/dashboard?cinema_id=2", headers=headers)
    assert forbidden_resp.status_code == 403
    assert "not authorized to access cinema 2" in forbidden_resp.json()["detail"]

    # 3. Fetch CSV export for cinema 1
    exp_resp = await client.get("/api/v1/admin/operations/export?cinema_id=1", headers=headers)
    assert exp_resp.status_code == 200
    assert exp_resp.headers["content-type"].startswith("text/csv")
    assert "Showtime ID,Movie Title,Auditorium,Start Time" in exp_resp.text
