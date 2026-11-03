import pytest_asyncio
import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./cineverse.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["USE_FAKEREDIS_FALLBACK"] = "True"

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal


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
