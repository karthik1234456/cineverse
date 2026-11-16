import asyncio
import time
import pytest
import pytest_asyncio
import httpx
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.auth import User, RoleEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.cinema import Auditorium
from app.config import settings
from app.services.hold_service import hold_seats, get_hold_quote, reset_hold_tracking
from app.services.auth_service import hash_password


@pytest.fixture(autouse=True)
def setup_hold_env():
    reset_hold_tracking()
    yield
    reset_hold_tracking()


@pytest.mark.asyncio
async def test_regression_missing_greenlet_resolved():
    """
    Regression Test: Verifies that get_hold_quote never throws MissingGreenlet or 500
    even if relationship attributes were not pre-loaded or are accessed asynchronously.
    """
    async with AsyncSessionLocal() as session:
        # Fetch an auditorium with showtimes
        st_res = await session.execute(select(Showtime).limit(1))
        showtime = st_res.scalars().first()
        assert showtime is not None, "Showtime required for test"

        # Find or create a test user
        user_res = await session.execute(select(User).where(User.email == "test_hold_user@example.com"))
        user = user_res.scalars().first()
        if not user:
            user = User(
                email="test_hold_user@example.com",
                full_name="Test Hold User",
                hashed_password=hash_password("Password123!"),
                role=RoleEnum.CUSTOMER,
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        # Ensure available seats exist
        seats_res = await session.execute(
            select(SeatInventory)
            .where(SeatInventory.showtime_id == showtime.id, SeatInventory.status == SeatStatusEnum.AVAILABLE)
            .limit(2)
        )
        avail_seats = seats_res.scalars().all()
        assert len(avail_seats) >= 1, "At least 1 seat needed for hold"
        seat_ids = [s.seat_id for s in avail_seats]

        # 1. Create a real hold
        hold_resp = await hold_seats(
            session,
            showtime_id=showtime.id,
            seat_ids=seat_ids,
            user_id=user.id,
            client_ip="127.0.0.1"
        )
        hold_id = hold_resp["hold_id"]
        assert hold_id.startswith("hold_")

        # 2. Fetch the hold quote - this used to fail with MissingGreenlet
        quote = await get_hold_quote(session, hold_id, user)
        assert quote is not None
        assert quote["hold_id"] == hold_id
        assert quote["ticket_subtotal"] > 0
        assert "requires_glasses" in quote
        assert "screen_format" in quote
        assert "tech_specs_display" in quote
        assert quote["final_total"] >= quote["ticket_subtotal"]


@pytest.mark.asyncio
async def test_hold_and_checkout_with_redis_stopped():
    """
    Verifies that when Redis is completely stopped / unreachable,
    hold operations and checkout quote calls degrade gracefully and complete with 200 (zero 500 errors).
    """
    class BrokenRedis:
        async def ping(self):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def get(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def set(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def setex(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def ttl(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def scard(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def sadd(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def srem(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def delete(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def publish(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        async def eval(self, *args, **kwargs):
            raise ConnectionError("Redis server connection refused: Redis is stopped")
        def pipeline(self):
            raise ConnectionError("Redis server connection refused: Redis is stopped")

    async def get_broken_redis():
        return BrokenRedis()

    with patch("app.redis_client.get_redis_client", side_effect=get_broken_redis), \
         patch("app.core.rate_limiter.get_redis_client", side_effect=get_broken_redis), \
         patch("app.services.hold_service.get_redis_client", side_effect=get_broken_redis):

        async with AsyncSessionLocal() as session:
            st_res = await session.execute(select(Showtime).limit(1))
            showtime = st_res.scalars().first()

            user_res = await session.execute(select(User).where(User.email == "test_hold_user@example.com"))
            user = user_res.scalars().first()

            # Find available seat
            seats_res = await session.execute(
                select(SeatInventory)
                .where(SeatInventory.showtime_id == showtime.id, SeatInventory.status == SeatStatusEnum.AVAILABLE)
                .limit(1)
            )
            avail_seats = seats_res.scalars().all()
            if not avail_seats:
                # Release an existing hold for testing
                held_res = await session.execute(
                    select(SeatInventory).where(SeatInventory.showtime_id == showtime.id).limit(1)
                )
                s = held_res.scalars().first()
                s.status = SeatStatusEnum.AVAILABLE
                s.hold_id = None
                s.held_by_user_id = None
                await session.commit()
                seat_ids = [s.seat_id]
            else:
                seat_ids = [avail_seats[0].seat_id]

            # 1. Hold seats with Redis completely stopped
            hold_resp = await hold_seats(
                session,
                showtime_id=showtime.id,
                seat_ids=seat_ids,
                user_id=user.id,
                client_ip="192.168.1.100"
            )
            assert hold_resp["hold_id"].startswith("hold_")

            # 2. Get checkout quote with Redis completely stopped
            quote = await get_hold_quote(session, hold_resp["hold_id"], user)
            assert quote["hold_id"] == hold_resp["hold_id"]
            assert quote["final_total"] > 0


@pytest.mark.asyncio
async def test_checkout_with_network_blocked():
    """
    Verifies that when outbound network connectivity to external services
    (Cloudflare Turnstile, TMDB, external APIs) is completely blocked,
    holds and checkout still complete successfully without hanging or failing.
    """
    async def mock_network_blocked(*args, **kwargs):
        raise httpx.ConnectError("Network unreachable: simulated offline / blocked external network")

    with patch("httpx.AsyncClient.post", side_effect=mock_network_blocked), \
         patch("httpx.AsyncClient.get", side_effect=mock_network_blocked):

        async with AsyncSessionLocal() as session:
            st_res = await session.execute(select(Showtime).limit(1))
            showtime = st_res.scalars().first()

            user_res = await session.execute(select(User).where(User.email == "test_hold_user@example.com"))
            user = user_res.scalars().first()

            # Find or reset an available seat
            seats_res = await session.execute(
                select(SeatInventory)
                .where(SeatInventory.showtime_id == showtime.id, SeatInventory.status == SeatStatusEnum.AVAILABLE)
                .limit(1)
            )
            avail_seats = seats_res.scalars().all()
            if not avail_seats:
                s = (await session.execute(select(SeatInventory).where(SeatInventory.showtime_id == showtime.id).limit(1))).scalars().first()
                s.status = SeatStatusEnum.AVAILABLE
                s.hold_id = None
                s.held_by_user_id = None
                await session.commit()
                seat_ids = [s.seat_id]
            else:
                seat_ids = [avail_seats[0].seat_id]

            # 1. Hold seats with external network blocked (even with a captcha token)
            t0 = time.perf_counter()
            hold_resp = await hold_seats(
                session,
                showtime_id=showtime.id,
                seat_ids=seat_ids,
                user_id=user.id,
                client_ip="203.0.113.42",
                captcha_token="external-turnstile-token-sample"
            )
            duration = (time.perf_counter() - t0) * 1000
            assert hold_resp["hold_id"].startswith("hold_")
            # Must not hang (less than 1500 ms even with failed external call)
            assert duration < 1500, f"Hold took {duration}ms with network blocked"

            # 2. Checkout quote load
            quote = await get_hold_quote(session, hold_resp["hold_id"], user)
            assert quote["hold_id"] == hold_resp["hold_id"]


@pytest.mark.asyncio
async def test_timing_targets_hold_and_checkout():
    """
    Verifies performance targets:
    - Hold call under 500 ms p95 for up to 20 seats
    - Checkout page load / quote under 300 ms
    """
    async with AsyncSessionLocal() as session:
        # Use Auditorium 39 (large 522-seat hall) or any large hall
        st_res = await session.execute(
            select(Showtime)
            .where(Showtime.auditorium_id == 39)
            .limit(1)
        )
        showtime = st_res.scalars().first()
        if not showtime:
            showtime = (await session.execute(select(Showtime).limit(1))).scalars().first()

        user_res = await session.execute(select(User).where(User.email == "test_hold_user@example.com"))
        user = user_res.scalars().first()

        # Find 20 seats to test
        seats_res = await session.execute(
            select(SeatInventory)
            .where(SeatInventory.showtime_id == showtime.id)
            .limit(20)
        )
        test_seats = seats_res.scalars().all()
        # Reset them to AVAILABLE for timing run
        for s in test_seats:
            s.status = SeatStatusEnum.AVAILABLE
            s.hold_id = None
            s.held_by_user_id = None
        await session.commit()
        seat_ids_20 = [s.seat_id for s in test_seats]

        # Benchmark Hold Call with MAX_SEATS_PER_BOOKING=20
        hold_timings = []
        with patch.object(settings, "MAX_SEATS_PER_BOOKING", 20):
            for i in range(3):
                # Reset seats for next iteration
                for s in test_seats:
                    s.status = SeatStatusEnum.AVAILABLE
                    s.hold_id = None
                    s.held_by_user_id = None
                await session.commit()

                start_t = time.perf_counter()
                resp = await hold_seats(
                    session,
                    showtime_id=showtime.id,
                    seat_ids=seat_ids_20,
                    user_id=user.id,
                    client_ip=f"10.0.0.{i+1}"
                )
                elapsed_ms = (time.perf_counter() - start_t) * 1000
                hold_timings.append(elapsed_ms)
                last_hold_id = resp["hold_id"]

        avg_hold_ms = sum(hold_timings) / len(hold_timings)
        print(f"\nHold timings for 20 seats (ms): {hold_timings}, Avg: {avg_hold_ms:.1f}ms")
        # Assert hold call under 500 ms p95
        assert all(t < 500 for t in hold_timings), f"Hold call exceeded 500ms target: {hold_timings}"

        # Benchmark Checkout Quote Call
        quote_timings = []
        for _ in range(5):
            start_q = time.perf_counter()
            q = await get_hold_quote(session, last_hold_id, user)
            elapsed_q_ms = (time.perf_counter() - start_q) * 1000
            quote_timings.append(elapsed_q_ms)

        avg_quote_ms = sum(quote_timings) / len(quote_timings)
        print(f"Checkout quote timings (ms): {quote_timings}, Avg: {avg_quote_ms:.1f}ms")
        # Assert checkout load under 300 ms
        assert all(t < 300 for t in quote_timings), f"Checkout quote call exceeded 300ms target: {quote_timings}"
