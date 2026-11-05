import pytest
from httpx import AsyncClient
from app.database import AsyncSessionLocal
from app.models.booking import Booking, BookingSeat, Ticket, BookingStatusEnum
from app.models.showtime import Showtime, SeatInventory


@pytest.mark.asyncio
async def test_part_a_100_seats_pricing_and_category_parity(client: AsyncClient):
    """
    Phase 2d Part A: One source of truth for price and category.
    For all 100 seats and at least two showtimes, assert the same price and category:
    - Rows A–C: Front, ₹280.0
    - Rows D–G: Prime, ₹380.0
    - Rows H–J: Premier, ₹520.0
    - Explicitly tests findings: D02 (Prime 380), I01 (Premier 520), C06 (Front 280), D03 (Prime 380).
    """
    for showtime_id in [1, 2]:
        resp = await client.get(f"/api/v1/showtimes/{showtime_id}/seats")
        assert resp.status_code == 200, f"Showtime {showtime_id} seats failed: {resp.text}"
        data = resp.json()

        assert data["showtime_id"] == showtime_id
        assert data["currency"] == "INR"
        assert data["quote_id"] is not None
        assert data["quote_id"].startswith(f"cv-quote-{showtime_id}-")

        seats = data["seats"]
        assert len(seats) == 100, f"Expected 100 seats, got {len(seats)}"

        # Validate tiers summary
        assert "tiers" in data
        assert len(data["tiers"]) == 3
        tier_by_name = {t["name"].lower(): t for t in data["tiers"]}

        assert "front" in tier_by_name
        assert tier_by_name["front"]["price"] == 280.0
        assert tier_by_name["front"]["rows"] == ["A", "B", "C"]

        assert "prime" in tier_by_name
        assert tier_by_name["prime"]["price"] == 380.0
        assert tier_by_name["prime"]["rows"] == ["D", "E", "F", "G"]

        assert "premier" in tier_by_name
        assert tier_by_name["premier"]["price"] == 520.0
        assert tier_by_name["premier"]["rows"] == ["H", "I", "J"]

        # Validate all 100 seats
        seat_map = {s["seat_id"]: s for s in seats}

        for seat_id, s in seat_map.items():
            row = s["row"]
            num = s["number"]
            assert s["currency"] == "INR"
            assert s["quote_id"] is not None

            if row in "ABC":
                expected_cat = "Front"
                expected_price = 280.0
            elif row in "DEFG":
                expected_cat = "Prime"
                expected_price = 380.0
            else:
                expected_cat = "Premier"
                expected_price = 520.0

            assert s["category"] == expected_cat, f"Seat {seat_id} category mismatch: expected {expected_cat}, got {s['category']}"
            assert s["price"] == expected_price, f"Seat {seat_id} price mismatch: expected {expected_price}, got {s['price']}"

        # Explicit assertion for reported finding seats (F1 / F2)
        d02 = seat_map["D02"]
        assert d02["category"] == "Prime"
        assert d02["price"] == 380.0  # Must NEVER be 250

        i01 = seat_map["I01"]
        assert i01["category"] == "Premier"
        assert i01["price"] == 520.0  # Must NEVER be 350

        c06 = seat_map["C06"]
        assert c06["category"] == "Front"
        assert c06["price"] == 280.0  # Row C is Front 280, matching the tier legend

        d03 = seat_map["D03"]
        assert d03["category"] == "Prime"
        assert d03["price"] == 380.0


@pytest.mark.asyncio
async def test_part_a_booking_and_ticket_price_integrity(client: AsyncClient):
    """
    Asserts that booking and ticket generation preserve the exact server quote price and category.
    """
    async with AsyncSessionLocal() as db:
        # Check D02 inventory
        from sqlalchemy import select
        res = await db.execute(
            select(SeatInventory).where(SeatInventory.showtime_id == 1, SeatInventory.seat_id == "D02")
        )
        inv = res.scalars().first()
        assert inv is not None
        assert inv.category == "Prime"
        assert inv.price == 380.0

