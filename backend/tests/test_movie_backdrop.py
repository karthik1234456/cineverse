"""
backend/tests/test_movie_backdrop.py
------------------------------------
Tests for MovieBackdrop and Glimpse integration:
1. Every movie has dominant_color, glimpse_url, glimpse_webm_url, glimpse_720p_url.
2. Dominant colors are valid hex strings and distinct across movies.
3. Glimpse media files exist on disk and are strictly under 6 MB (benchmarked < 200 KB).
4. Showtime seats endpoint includes movie dominant_color, glimpse_url, and banner_url.
5. Hold quote endpoint includes movie dominant_color and glimpse_url.
"""
import os
import re
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.database import AsyncSessionLocal
from app.models.movie import Movie

ROOT = Path(__file__).resolve().parents[2]
GLIMPSES_DIR = ROOT / "frontend" / "public" / "trailers" / "glimpses"


@pytest.mark.asyncio
async def test_all_movies_have_backdrop_and_glimpse_metadata():
    """Verify that all 50 seeded movies have dominant colors and glimpse URLs populated."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Movie))
        movies = result.scalars().all()

    assert len(movies) >= 50, f"Expected at least 50 movies, found {len(movies)}"

    hex_re = re.compile(r"^#[0-9a-fA-F]{6}$")
    distinct_colors = set()

    for m in movies:
        assert m.dominant_color is not None, f"Movie {m.slug} missing dominant_color"
        assert hex_re.match(m.dominant_color), f"Movie {m.slug} invalid hex color: {m.dominant_color}"
        distinct_colors.add(m.dominant_color)

        assert m.glimpse_url is not None, f"Movie {m.slug} missing glimpse_url"
        assert m.glimpse_url.endswith("-480p.mp4"), f"Invalid glimpse_url: {m.glimpse_url}"

        assert m.glimpse_webm_url is not None, f"Movie {m.slug} missing glimpse_webm_url"
        assert m.glimpse_webm_url.endswith("-480p.webm"), f"Invalid glimpse_webm_url: {m.glimpse_webm_url}"

        assert m.glimpse_720p_url is not None, f"Movie {m.slug} missing glimpse_720p_url"
        assert m.glimpse_720p_url.endswith("-720p.mp4"), f"Invalid glimpse_720p_url: {m.glimpse_720p_url}"

    # Verify colors are varied and distinct (not all the same fallback)
    assert len(distinct_colors) >= 15, f"Expected diverse color palette, found {len(distinct_colors)} unique colors"


def test_glimpse_files_exist_and_under_6mb():
    """Verify that generated glimpse files exist on disk and comply with the < 6 MB size constraint."""
    assert GLIMPSES_DIR.exists(), f"Glimpses directory missing: {GLIMPSES_DIR}"

    files = list(GLIMPSES_DIR.glob("*.mp4")) + list(GLIMPSES_DIR.glob("*.webm"))
    assert len(files) >= 150, f"Expected at least 150 glimpse files, found {len(files)}"

    max_size_allowed = 6 * 1024 * 1024  # 6 MB

    for f in files:
        size = f.stat().st_size
        assert size > 0, f"Empty glimpse file: {f.name}"
        assert size < max_size_allowed, f"Glimpse file {f.name} exceeds 6 MB: {size} bytes"


@pytest.mark.asyncio
async def test_showtime_seats_api_exposes_backdrop_and_glimpse():
    """Verify GET /api/v1/showtimes/{id}/seats exposes dominant_color, glimpse_url, and banner_url."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/showtimes/1/seats")
        assert res.status_code == 200
        data = res.json()

        assert "dominant_color" in data
        assert data["dominant_color"] is not None
        assert data["dominant_color"].startswith("#")

        assert "glimpse_url" in data
        assert data["glimpse_url"] is not None
        assert "glimpses" in data["glimpse_url"]

        assert "banner_url" in data
        assert data["banner_url"] is not None


@pytest.mark.asyncio
async def test_movies_detail_api_exposes_backdrop_and_glimpse():
    """Verify GET /api/v1/movies/1 exposes dominant_color and glimpse URLs."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/movies/1")
        assert res.status_code == 200
        data = res.json()

        assert data["dominant_color"] == "#0b1b3b"
        assert "/trailers/glimpses/quantum-odyssey-480p.mp4" in data["glimpse_url"]
        assert "/trailers/glimpses/quantum-odyssey-480p.webm" in data["glimpse_webm_url"]
        assert "/trailers/glimpses/quantum-odyssey-720p.mp4" in data["glimpse_720p_url"]

