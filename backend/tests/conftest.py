import pytest_asyncio
import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./cineverse.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["USE_FAKEREDIS_FALLBACK"] = "True"

from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture(scope="function")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
