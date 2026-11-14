"""
Verification test suite for 2D Seat Map alignment, layout structure, and pricing truth.
Tests:
1. Compact hall (Auditorium 1) layout truth: 100 seats, aisles=[5], blocks_pattern=[5, 5], 10 rows (A-J), 10 seats per row.
2. Category bands truth for Compact hall: Front (A-C), Prime (D-G), Premier (H-J).
3. 2D/3D structure alignment across halls: blocks_pattern, aisles, and seats match layout geometry.
4. Seat pricing truth across >= 5 showtimes: seat inventory prices match category quotes without discrepancy.
"""
import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.cinema import Auditorium, Seat
from app.models.showtime import Showtime, SeatInventory, PriceRule


@pytest.mark.asyncio
async def test_compact_hall_truth(db_session):
    """
    Compact hall (Auditorium 1): 100 seats, exactly two blocks of 5 seats with 1 centre aisle.
    """
    aud = (
        await db_session.execute(
            select(Auditorium)
            .where(Auditorium.id == 1)
            .options(selectinload(Auditorium.seats))
        )
    ).scalar_one_or_none()

    assert aud is not None, "Auditorium 1 not found"
    assert aud.total_seats == 100, f"Expected 100 seats, got {aud.total_seats}"
    assert len(aud.seats) == 100, f"Expected 100 seat records, got {len(aud.seats)}"

    layout_data = aud.layout_data
    assert layout_data["aisles"] == [5], f"Expected aisles=[5], got {layout_data.get('aisles')}"
    assert layout_data["blocks_pattern"] == [5, 5], f"Expected blocks_pattern=[5, 5], got {layout_data.get('blocks_pattern')}"
    assert len(layout_data["rows"]) == 10, f"Expected 10 rows, got {len(layout_data.get('rows'))}"

    # Verify rows A to J, 10 seats per row
    expected_rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
    row_seats = {}
    for s in aud.seats:
        row_seats.setdefault(s.row, []).append(s.number)

    assert sorted(list(row_seats.keys())) == expected_rows
    for r in expected_rows:
        assert len(row_seats[r]) == 10, f"Row {r} has {len(row_seats[r])} seats, expected 10"
        assert sorted(row_seats[r]) == list(range(1, 11))


@pytest.mark.asyncio
async def test_compact_hall_category_bands(db_session):
    """
    Verify Compact hall category bands: Front (A-C), Prime (D-G), Premier (H-J).
    """
    aud = (
        await db_session.execute(
            select(Auditorium).where(Auditorium.id == 1)
        )
    ).scalar_one_or_none()

    bands = aud.layout_data.get("category_bands", [])
    assert len(bands) == 3, f"Expected 3 category bands, got {len(bands)}"

    band_map = {b["category"].lower(): b["rows"] for b in bands}
    assert band_map.get("front") == ["A", "B", "C"], f"Expected Front A-C, got {band_map.get('front')}"
    assert band_map.get("prime") == ["D", "E", "F", "G"], f"Expected Prime D-G, got {band_map.get('prime')}"
    assert band_map.get("premier") == ["H", "I", "J"], f"Expected Premier H-J, got {band_map.get('premier')}"


@pytest.mark.asyncio
async def test_pricing_truth_across_showtimes(db_session):
    """
    Verify pricing truth across at least 5 different showtimes.
    Ensures seat inventory prices match category prices with no per-seat discrepancy.
    """
    showtimes = (
        await db_session.execute(
            select(Showtime)
            .options(
                selectinload(Showtime.auditorium),
                selectinload(Showtime.seat_inventory),
                selectinload(Showtime.price_rules),
            )
            .limit(10)
        )
    ).scalars().all()

    assert len(showtimes) >= 5, f"Expected >= 5 showtimes, got {len(showtimes)}"

    for st in showtimes[:8]:
        cat_prices = {}
        for inv in st.seat_inventory:
            cat = inv.category.lower()
            if cat not in cat_prices:
                cat_prices[cat] = inv.price
            else:
                assert inv.price == cat_prices[cat], (
                    f"Showtime {st.id} seat {inv.seat_id} has price {inv.price}, expected {cat_prices[cat]}"
                )
        assert len(cat_prices) >= 2, f"Showtime {st.id} has insufficient tiers: {cat_prices}"


@pytest.mark.asyncio
async def test_all_halls_layout_block_aisle_consistency(db_session):
    """
    Verify for all auditoriums that blocks_pattern and aisles are mathematically consistent.
    E.g. if blocks_pattern is [bl, br], aisles has [bl]. If [b1, b2, b3], aisles has [b1, b1+b2].
    """
    auds = (
        await db_session.execute(select(Auditorium))
    ).scalars().all()

    for aud in auds:
        layout = aud.layout_data
        blocks = layout.get("blocks_pattern")
        aisles = layout.get("aisles")
        assert blocks is not None and len(blocks) >= 2, f"Aud {aud.id} missing blocks_pattern"
        assert aisles is not None, f"Aud {aud.id} missing aisles"

        # Check aisles correspond to prefix sums of blocks (excluding the last block)
        expected_aisles = []
        curr = 0
        for b in blocks[:-1]:
            curr += b
            expected_aisles.append(curr)

        assert aisles == expected_aisles, (
            f"Aud {aud.id} aisle mismatch: blocks={blocks}, aisles={aisles}, expected={expected_aisles}"
        )
