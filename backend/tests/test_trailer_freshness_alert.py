import pytest
import asyncio
from datetime import datetime, timezone, date
from unittest.mock import patch, MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.movie import Movie
from app.services.trailer_freshness import (
    run_trailer_freshness_job,
    get_freshness_alerts,
    get_freshness_history,
    ALERT_NOTICES,
    FRESHNESS_AUDIT_LOG
)

@pytest.mark.asyncio
async def test_trailer_freshness_alert_simulation():
    # Setup test in-memory SQLite database
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Create a test movie with a YouTube trailer
        test_movie = Movie(
            id=999,
            title="Simulated Restricted Movie",
            slug="simulated-restricted-movie",
            synopsis="Testing trailer loss and alerting",
            duration_minutes=110,
            certificate="UA",
            release_date=date(2026, 11, 20),
            languages='["English"]',
            genres='["Action"]',
            formats='["2D"]',
            is_tmdb=True,
            is_showcase=False,
            source="tmdb",
            tmdb_id=88888,
            youtube_trailer_id="DEFUNCT_RESTRICTED_KEY_123",
            trailer_url="https://www.youtube-nocookie.com/embed/DEFUNCT_RESTRICTED_KEY_123",
            trailer_embeddable=True,
            trailer_reason="Working official trailer",
            trailer_source_type="youtube",
        )
        session.add(test_movie)
        await session.commit()

        # Mock check_youtube_video_details to report that this video is broken/restricted (False, False, 0, 0, None)
        # Mock _execute_tmdb_curl to return no backup candidates
        with patch("app.services.trailer_freshness.check_youtube_video_details") as mock_check, \
             patch("app.services.trailer_freshness._execute_tmdb_curl") as mock_tmdb, \
             patch("app.services.trailer_freshness.dispatch_alert_notification") as mock_dispatch:

            mock_check.return_value = (False, False, 0, 0, None)
            mock_tmdb.return_value = {"results": []}

            # Run freshness job
            report = await run_trailer_freshness_job(session)

            # Assertions
            assert report["lost_count"] == 1, f"Expected 1 lost trailer, got {report['lost_count']}"
            assert report["alerts_raised"] == 1, f"Expected 1 alert raised, got {report['alerts_raised']}"
            assert len(report["alerts"]) == 1

            alert = report["alerts"][0]
            assert alert["movie_id"] == 999
            assert alert["title"] == "Simulated Restricted Movie"
            assert alert["broken_key"] == "DEFUNCT_RESTRICTED_KEY_123"

            # Verify alert dispatch was called
            mock_dispatch.assert_called_once_with(alert)

            # Verify movie was downgraded to not embeddable
            updated_movie = await session.get(Movie, 999)
            assert updated_movie.trailer_embeddable is False
            assert updated_movie.youtube_trailer_id is None
            assert updated_movie.trailer_url is None
            assert "Lost embeddable trailer" in updated_movie.trailer_reason

            print("\n[SUCCESS] Trailer loss simulation test passed! Alert raised and dispatched correctly.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_trailer_freshness_alert_simulation())
