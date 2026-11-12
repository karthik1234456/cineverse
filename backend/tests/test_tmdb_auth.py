"""Tests for TMDB Authentication Detection and Readiness Status.
Ensures both v3 api_key (32-hex) and v4 bearer token (eyJ...) are accepted via
either TMDB_API_KEY or TMDB_READ_TOKEN, and ensures readiness banners report
accurate status without leaking credentials.
"""

import pytest
import httpx
from unittest.mock import patch, MagicMock, AsyncMock
from app.config import get_tmdb_auth_details
from app.services.catalog.tmdb import check_tmdb_key_status


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    """Bypass full database seeding for pure auth unit tests."""
    yield


@pytest.fixture(scope="function", autouse=True)
def per_test_state_reset():
    """Bypass database resets for pure auth unit tests."""
    yield


async def test_tmdb_auth_v3_api_key_via_api_key():
    fake_hex_32 = "a" * 32
    auth = get_tmdb_auth_details(api_key=fake_hex_32, read_token=None)
    assert auth["mode"] == "v3 api_key"
    assert auth["is_set"] is True
    assert auth["source_var"] == "TMDB_API_KEY"
    assert auth["value_length"] == 32
    assert auth["params"] == {"api_key": fake_hex_32}
    assert auth["headers"] == {}


async def test_tmdb_auth_v3_api_key_via_read_token():
    fake_hex_32 = "b" * 32
    auth = get_tmdb_auth_details(api_key="", read_token=fake_hex_32)
    assert auth["mode"] == "v3 api_key"
    assert auth["is_set"] is True
    assert auth["source_var"] == "TMDB_READ_TOKEN"
    assert auth["value_length"] == 32
    assert auth["params"] == {"api_key": fake_hex_32}
    assert auth["headers"] == {}


async def test_tmdb_auth_v4_bearer_token_via_read_token():
    fake_v4_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"
    auth = get_tmdb_auth_details(api_key="", read_token=fake_v4_token)
    assert auth["mode"] == "v4 bearer token"
    assert auth["is_set"] is True
    assert auth["source_var"] == "TMDB_READ_TOKEN"
    assert auth["value_length"] == len(fake_v4_token)
    assert auth["params"] == {}
    assert auth["headers"] == {"Authorization": f"Bearer {fake_v4_token}"}


async def test_tmdb_auth_v4_bearer_token_via_api_key():
    fake_v4_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"
    auth = get_tmdb_auth_details(api_key=fake_v4_token, read_token="")
    assert auth["mode"] == "v4 bearer token"
    assert auth["is_set"] is True
    assert auth["source_var"] == "TMDB_API_KEY"
    assert auth["value_length"] == len(fake_v4_token)
    assert auth["params"] == {}
    assert auth["headers"] == {"Authorization": f"Bearer {fake_v4_token}"}


async def test_tmdb_auth_missing():
    auth = get_tmdb_auth_details(api_key="", read_token="")
    assert auth["mode"] == "missing"
    assert auth["is_set"] is False
    assert auth["source_var"] is None
    assert auth["value_length"] == 0
    assert auth["params"] == {}
    assert auth["headers"] == {}


async def test_tmdb_auth_empty_strings():
    auth = get_tmdb_auth_details(api_key="   ", read_token="")
    assert auth["mode"] == "missing"
    assert auth["is_set"] is False


@patch("app.services.catalog.tmdb.get_tmdb_auth_details")
async def test_check_tmdb_key_status_missing(mock_auth):
    mock_auth.return_value = {
        "mode": "missing",
        "token": "",
        "is_set": False,
        "source_var": None,
        "value_length": 0,
        "params": {},
        "headers": {},
    }
    status = await check_tmdb_key_status(force_fresh=True)
    assert status["status"] == "key_missing"
    assert status["is_valid"] is False
    assert status["banner"] == "Real posters unavailable: TMDB key missing"


@patch("httpx.AsyncClient.get")
@patch("app.services.catalog.tmdb.get_tmdb_auth_details")
async def test_check_tmdb_key_status_rejected_401(mock_auth, mock_get):
    mock_auth.return_value = {
        "mode": "v3 api_key",
        "token": "dummy",
        "is_set": True,
        "source_var": "TMDB_API_KEY",
        "value_length": 32,
        "params": {"api_key": "dummy"},
        "headers": {},
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_get.return_value = mock_resp

    status = await check_tmdb_key_status(force_fresh=True)
    assert status["status"] == "key_rejected"
    assert status["is_valid"] is False
    assert status["http_status"] == 401
    assert status["banner"] == "Real posters unavailable: TMDB key rejected (HTTP 401)"


@patch("httpx.AsyncClient.get")
@patch("app.services.catalog.tmdb.get_tmdb_auth_details")
async def test_check_tmdb_key_status_network_error(mock_auth, mock_get):
    mock_auth.return_value = {
        "mode": "v4 bearer token",
        "token": "dummy",
        "is_set": True,
        "source_var": "TMDB_READ_TOKEN",
        "value_length": 150,
        "params": {},
        "headers": {"Authorization": "Bearer dummy"},
    }
    mock_get.side_effect = httpx.ConnectError("Connection timed out")

    status = await check_tmdb_key_status(force_fresh=True)
    assert status["status"] == "network_error"
    assert status["is_valid"] is False
    assert status["banner"] == "Real posters unavailable: network error"


@patch("httpx.AsyncClient.get")
@patch("app.services.catalog.tmdb.get_tmdb_auth_details")
async def test_check_tmdb_key_status_ok(mock_auth, mock_get):
    mock_auth.return_value = {
        "mode": "v3 api_key",
        "token": "dummy",
        "is_set": True,
        "source_var": "TMDB_API_KEY",
        "value_length": 32,
        "params": {"api_key": "dummy"},
        "headers": {},
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_get.return_value = mock_resp

    status = await check_tmdb_key_status(force_fresh=True)
    assert status["status"] == "ok"
    assert status["is_valid"] is True
    assert status["http_status"] == 200
    assert status["banner"] is None
