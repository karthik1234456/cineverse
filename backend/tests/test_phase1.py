import pytest
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from app.models.cinema import City, Cinema, Auditorium, Seat
from app.models.movie import Movie
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingSeat, BookingStatusEnum
from app.seed.seeder import seed_database
from pathlib import Path
import json


@pytest.mark.asyncio
async def test_seeding_twice_idempotent(db_session):
    """Test: Seeding twice does not duplicate rows."""
    # First check current count
    city_count_1 = (await db_session.execute(select(func.count(City.id)))).scalar()
    cinema_count_1 = (await db_session.execute(select(func.count(Cinema.id)))).scalar()
    movie_count_1 = (await db_session.execute(select(func.count(Movie.id)))).scalar()

    # Run seed again
    await seed_database()

    # Re-check count
    city_count_2 = (await db_session.execute(select(func.count(City.id)))).scalar()
    cinema_count_2 = (await db_session.execute(select(func.count(Cinema.id)))).scalar()
    movie_count_2 = (await db_session.execute(select(func.count(Movie.id)))).scalar()

    assert city_count_1 == city_count_2 == 7, "Cities count changed or not 7"
    assert cinema_count_1 == cinema_count_2 >= 4, "Cinemas count changed"
    assert movie_count_1 == movie_count_2 >= 12, "Movies count changed"


@pytest.mark.asyncio
async def test_100_seats_match_json_ids(db_session):
    """Test: 100 seats in DB match the JSON ids exactly."""
    layout_path = Path("frontend/public/models/seat_layout_v2.json")
    if not layout_path.exists():
        layout_path = Path("seat_layout_v2_1.json")
    
    with open(layout_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    json_seat_ids = {s.get("seat_id") for s in data.get("seats", []) if s.get("seat_id")}
    assert len(json_seat_ids) == 100, f"Expected 100 seats in JSON, got {len(json_seat_ids)}"

    # Check seats in DB for auditorium 1
    res = await db_session.execute(select(Seat).where(Seat.auditorium_id == 1))
    db_seats = res.scalars().all()
    assert len(db_seats) == 100, f"Expected 100 seats in DB, got {len(db_seats)}"

    db_seat_ids = {s.seat_id for s in db_seats}
    assert db_seat_ids == json_seat_ids, "DB seat IDs do not match JSON seat IDs exactly"

    # Also check node_names match
    for s in db_seats:
        assert s.node_name.startswith("seat_"), f"Invalid node_name: {s.node_name}"


@pytest.mark.asyncio
async def test_two_confirmed_bookings_rejected(db_session):
    """Test: Inserting two confirmed bookings for one seat and showtime is rejected by the DB."""
    # Find a valid showtime
    res = await db_session.execute(select(Showtime).limit(1))
    st = res.scalars().first()
    assert st is not None

    # First booking for showtime and seat A01
    b1 = Booking(
        booking_code="CV-TEST-01",
        user_id=1,
        showtime_id=st.id,
        status=BookingStatusEnum.CONFIRMED,
        final_total_amount=280.0
    )
    db_session.add(b1)
    await db_session.flush()

    bs1 = BookingSeat(
        booking_id=b1.id,
        showtime_id=st.id,
        seat_id="A01",
        category="Front",
        price=280.0
    )
    db_session.add(bs1)
    await db_session.flush()

    # Second booking attempting to book the exact same seat and showtime
    b2 = Booking(
        booking_code="CV-TEST-02",
        user_id=2,
        showtime_id=st.id,
        status=BookingStatusEnum.CONFIRMED,
        final_total_amount=280.0
    )
    db_session.add(b2)
    await db_session.flush()

    bs2 = BookingSeat(
        booking_id=b2.id,
        showtime_id=st.id,
        seat_id="A01",
        category="Front",
        price=280.0
    )
    db_session.add(bs2)

    with pytest.raises(IntegrityError):
        await db_session.flush()

    await db_session.rollback()


@pytest.mark.asyncio
async def test_health_and_readiness(async_client):
    """Test: /health and /ready return 200 OK."""
    health_res = await async_client.get("/health")
    assert health_res.status_code == 200
    h_data = health_res.json()
    assert h_data["status"] == "ok"
    assert "version" in h_data

    ready_res = await async_client.get("/ready")
    assert ready_res.status_code == 200
    r_data = ready_res.json()
    assert r_data["status"] == "ready"
    assert r_data["database"] == "connected"
    assert r_data["redis"] == "connected"


@pytest.mark.asyncio
async def test_auditorium_layout_served_from_db(async_client):
    """Test: GET /api/v1/auditoriums/{id}/layout serves JSON data from DB."""
    res = await async_client.get("/api/v1/auditoriums/1/layout")
    assert res.status_code == 200
    data = res.json()
    assert data["total_seats"] == 100
    assert len(data["seats"]) == 100
    assert data["seats"][0]["seat_id"] == "A01"
    assert data["seats"][0]["node_name"] == "seat_A_01"
