import pytest
import os
import glob
from unittest.mock import patch
from app.services.trailer_weekly_audit import (
    run_weekly_trailer_sample_audit,
    get_weekly_audit_alerts,
    get_weekly_audit_history,
    dispatch_weekly_audit_alert,
    WEEKLY_AUDIT_ALERTS,
)

@pytest.mark.asyncio
async def test_weekly_trailer_sample_audit_healthy(db_session):
    """Test standard sample audit: all valid titles pass, no alert triggered."""
    with patch("app.services.trailer_weekly_audit.check_youtube_video_details", return_value=(True, False, 1280, 720, "Sample")):
        report = await run_weekly_trailer_sample_audit(db_session)
        assert report["sampled_count"] > 0
        assert report["failure_rate_pct"] <= 5.0
        assert report["alert_triggered"] is False

        # Verify log file was written to evidence/weekly_audit
        log_files = glob.glob("evidence/weekly_audit/weekly_audit_*.json")
        assert len(log_files) > 0


@pytest.mark.asyncio
async def test_weekly_trailer_sample_audit_alert_over_5_percent(db_session):
    """Test simulated failures: when failure rate > 5%, alert is dispatched."""
    initial_alerts = len(get_weekly_audit_alerts())

    # Mock both check_youtube_video_details and os.path.exists to guarantee high failure rate
    with patch("app.services.trailer_weekly_audit.check_youtube_video_details", return_value=(False, True, 0, 0, "")), \
         patch("os.path.exists", return_value=False):
        report = await run_weekly_trailer_sample_audit(db_session)
        assert report["failure_rate_pct"] > 5.0
        assert report["alert_triggered"] is True
        assert len(get_weekly_audit_alerts()) > initial_alerts
        latest_alert = get_weekly_audit_alerts()[-1]
        assert latest_alert["type"] == "WEEKLY_AUDIT_FAILURE_RATE_EXCEEDED"
        assert latest_alert["failure_rate_pct"] > 5.0
