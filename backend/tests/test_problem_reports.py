import pytest
import base64
from httpx import AsyncClient
from app.config import settings
from app.services.scrubber import scrub_data, scrub_string
from app.schemas.problem_report import generate_antigravity_prompt
from app.models.auth import RoleEnum
from tests.factories import make_test_user


def test_scrubber_redacts_credentials_and_secrets():
    raw_text = (
        "User logged in with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThis "
        "and API key a1b2c3d4e5f60718293a4b5c6d7e8f90. "
        "Password was password: 'SuperSecret123!' and email user@example.com."
    )
    scrubbed = scrub_string(raw_text)
    assert "SuperSecret123!" not in scrubbed
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in scrubbed
    assert "a1b2c3d4e5f60718293a4b5c6d7e8f90" not in scrubbed
    assert "user@example.com" not in scrubbed
    assert "[REDACTED" in scrubbed


def test_scrubber_recursive_dict_redaction():
    payload = {
        "user": "Alice",
        "email": "alice@test.com",
        "authorization": "Bearer secret_token_123",
        "headers": {
            "cookie": "session_id=abcdef123456",
            "x-api-key": "0123456789abcdef0123456789abcdef"
        },
        "query": {
            "token": "sensitive_query_param",
            "mode": "3d"
        }
    }
    cleaned = scrub_data(payload)
    assert cleaned["authorization"] == "[REDACTED]"
    assert cleaned["headers"]["cookie"] == "[REDACTED]"
    assert cleaned["query"]["token"] == "[REDACTED]"
    assert cleaned["query"]["mode"] == "3d"


def test_generate_antigravity_prompt():
    class DummyReport:
        user_description = "The seats in row F overlap the cross aisle in walk mode."
        expected_behavior = "Seats should be aligned behind the safety handrail."
        url = "http://localhost:3000/cinemas/1/auditorium/3?showtime=57&mode=3d"
        route = "/cinemas/1/auditorium/3"
        build_stamp = "git:395f54d | built:2026-11-13 UTC"
        mode = "walk"
        auditorium_id = "3"
        showtime_id = 57
        cinema_id = 1
        selected_seats = ["F-10", "F-11"]
        browser_info = {"viewportWidth": 1280, "viewportHeight": 800, "devicePixelRatio": 2}
        render_metrics = {"fps": 58, "frameTimeMs": 17.2, "qualityTier": "beautiful"}
        console_logs = [{"level": "warn", "message": "High draw call count"}]
        network_requests = [{"method": "GET", "url": "/api/v1/showtimes/57/seats", "status": 200, "durationMs": 45}]

    prompt = generate_antigravity_prompt(DummyReport())
    assert "# Bug Report" in prompt
    assert "frontend/components/3d/WalkController.tsx" in prompt
    assert "frontend/components/3d/ProceduralAuditorium.tsx" in prompt
    assert "git:395f54d" in prompt
    assert "F-10, F-11" in prompt
    assert "High draw call count" in prompt


@pytest.mark.asyncio
async def test_submit_problem_report_api(client: AsyncClient, db_session):
    # Dummy 1x1 white pixel JPEG base64
    tiny_jpeg_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

    payload = {
        "user_description": "Trailer volume slider does not mute in Look around mode.",
        "expected_behavior": "Clicking mute should set volume to 0.",
        "screenshot_base64": tiny_jpeg_b64,
        "url": "http://localhost:3000/cinemas/2/auditorium/5?showtime=113&mode=3d",
        "route": "/cinemas/2/auditorium/5",
        "query_params": {"showtime": 113, "mode": "3d"},
        "build_stamp": "git:395f54d",
        "auditorium_id": "5",
        "showtime_id": 113,
        "cinema_id": 2,
        "mode": "overview",
        "selected_seats": ["C-12"],
        "console_logs": [
            {"level": "log", "message": "Auditorium mounted"},
            {"level": "error", "message": "Failed with token Bearer eyJhbGciOiJIUzI1NiJ9.secret.token"}
        ],
        "network_requests": [
            {"method": "GET", "url": "/api/v1/showtimes/113/seats", "status": 200, "durationMs": 35}
        ],
        "browser_info": {"viewportWidth": 1280, "viewportHeight": 800},
        "render_metrics": {"fps": 60, "qualityTier": "beautiful"}
    }

    res = await client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "submitted"
    assert "id" in data
    report_id = data["id"]

    # Now verify admin endpoints
    # 1. Non-admin cannot view
    res_unauth = await client.get("/api/v1/admin/reports")
    assert res_unauth.status_code in (401, 403)

    # 2. Authenticated Admin can list and view
    admin_user = await make_test_user(db_session, role=RoleEnum.ADMIN)
    from app.services.auth_service import create_access_token
    token = create_access_token({"sub": str(admin_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res_admin = await client.get("/api/v1/admin/reports", headers=headers)
    assert res_admin.status_code == 200
    reports = res_admin.json()
    assert any(r["id"] == report_id for r in reports)

    # Find the created report
    r = next(item for item in reports if item["id"] == report_id)
    assert r["mode"] == "overview"
    assert r["selected_seats"] == ["C-12"]
    # Verify token was scrubbed
    assert "eyJhbGciOiJIUzI1NiJ9.secret.token" not in str(r["console_logs"])
    assert "[REDACTED" in str(r["console_logs"])

    # Test "Export all open reports"
    res_export = await client.get("/api/v1/admin/reports/export", headers=headers)
    assert res_export.status_code == 200
    export_data = res_export.json()
    assert export_data["count"] >= 1
    assert any(item["id"] == report_id for item in export_data["reports"])
    exported_report = next(item for item in export_data["reports"] if item["id"] == report_id)
    assert "antigravity_prompt" in exported_report
    assert "frontend/components/3d/CameraController.tsx" in exported_report["antigravity_prompt"]


@pytest.mark.asyncio
async def test_feature_flag_disable_bug_reporting(client: AsyncClient):
    old_flag = settings.ENABLE_BUG_REPORTING
    try:
        settings.ENABLE_BUG_REPORTING = False
        payload = {
            "user_description": "Testing disabled bug reporting",
            "url": "http://localhost:3000/",
            "route": "/"
        }
        res = await client.post("/api/v1/reports", json=payload)
        assert res.status_code == 403
        assert "disabled" in res.json()["detail"].lower()
    finally:
        settings.ENABLE_BUG_REPORTING = old_flag
