import os
import sys
import asyncio
from datetime import datetime, date, time, timedelta
import pytest_asyncio
import pytest

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Dedicated isolated test database
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_cineverse.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["USE_FAKEREDIS_FALLBACK"] = "True"
os.environ["CATALOG_SOURCE"] = "local"


from httpx import AsyncClient, ASGITransport
from sqlalchemy import update, delete
from app.main import app
from app.database import AsyncSessionLocal, init_db, engine
from app.seed.seeder import seed_database
from app.services.hold_service import reset_hold_tracking
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingSeat, BookingAddon, Ticket
from app.models.payment import Payment, PaymentEvent, Refund
from app.models.operations import TicketScanLog, TicketTransferLog, FoodOrder
from app.models.waitlist import WaitlistEntry
from app.models.dynamic_pricing import DynamicPricingRule, PriceAuditLog


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    """Ensure dedicated test database is fresh and seeded once per test session."""
    async def _setup():
        await init_db()
        await seed_database()
    asyncio.run(_setup())
    yield


async def _cleanup_database_state():
    reset_hold_tracking()
    async with AsyncSessionLocal() as db:
        # Purge test bookings, tickets, addons, and logs created during tests
        await db.execute(delete(TicketScanLog))
        await db.execute(delete(TicketTransferLog))
        await db.execute(delete(FoodOrder))
        await db.execute(delete(WaitlistEntry))
        await db.execute(delete(PriceAuditLog))
        await db.execute(delete(DynamicPricingRule))
        await db.execute(delete(Ticket))
        await db.execute(delete(Refund))
        await db.execute(delete(PaymentEvent))
        await db.execute(delete(Payment))
        await db.execute(delete(BookingAddon))
        await db.execute(delete(BookingSeat))
        await db.execute(delete(Booking))

        # Reset Showtime 1 seat inventory for booking tests
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == 1)
            .values(status=SeatStatusEnum.AVAILABLE, hold_id=None, hold_expires_at=None, held_by_user_id=None)
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == 1, SeatInventory.seat_id == 'C01')
            .values(status=SeatStatusEnum.BOOKED, booking_id=1)
        )
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == 1, SeatInventory.seat_id == 'A06')
            .values(status=SeatStatusEnum.HELD, hold_id='cv-seed-hold-a06', hold_expires_at=datetime.utcnow() + timedelta(hours=2))
        )

        await db.commit()


@pytest_asyncio.fixture(scope="function", autouse=True)
async def per_test_state_reset():
    """
    Zero-pollution isolation fixture (FIX-02):
    Executes before AND after every test to guarantee pristine state.
    """
    await _cleanup_database_state()
    yield
    await _cleanup_database_state()


@pytest_asyncio.fixture(scope="function")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def async_client(client):
    yield client


@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
