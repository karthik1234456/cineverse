import os
import re
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine absolute paths for backend dir and repository root dir
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_backend_dir, ".."))
_backend_env = os.path.join(_backend_dir, ".env")
_root_env = os.path.join(_root_dir, ".env")

# Pre-load environment file safely from absolute paths (priority: backend/.env then repo root .env)
_loaded_env_path: Optional[str] = None
if os.path.exists(_backend_env):
    load_dotenv(_backend_env, override=False)
    _loaded_env_path = _backend_env
elif os.path.exists(_root_env):
    load_dotenv(_root_env, override=False)
    _loaded_env_path = _root_env
elif os.path.exists(".env"):
    load_dotenv(".env", override=False)
    _loaded_env_path = os.path.abspath(".env")



class Settings(BaseSettings):
    PROJECT_NAME: str = "CineVerse API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Environment tracking
    LOADED_ENV_PATH: Optional[str] = _loaded_env_path
    SERVER_WORKING_DIR: str = os.getcwd()

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite+aiosqlite:///{os.path.join(_root_dir, 'cineverse.db').replace(chr(92), '/')}"
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    USE_FAKEREDIS_FALLBACK: bool = True

    # Security & Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "cineverse_super_secret_jwt_encryption_key_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    TICKET_SIGNING_SECRET: str = os.getenv("TICKET_SIGNING_SECRET", "cineverse_ticket_hmac_secret_key_2026")

    # Booking & Hold Rules
    HOLD_DURATION_MINUTES: int = 5
    MAX_HOLD_EXTENSIONS: int = 1
    HOLD_EXTENSION_MINUTES: int = 3
    MAX_SEATS_PER_BOOKING: int = 8
    CONVENIENCE_FEE_PER_TICKET: float = 35.0
    GST_PERCENTAGE: float = 18.0

    # Feature Flags & Kill Switches (Operational Safeguards)
    ENABLE_VOICE_AGENT: bool = True
    ENABLE_3D_AUDITORIUM: bool = True
    ENABLE_DYNAMIC_PRICING: bool = True
    ENABLE_WAITLIST: bool = True
    ENABLE_OFFLINE_SCANNING: bool = True
    ENABLE_TICKET_TRANSFERS: bool = True  # Can be toggled to false via ENABLE_TICKET_TRANSFERS=false for state compliance
    ENABLE_BUG_REPORTING: bool = os.getenv("ENABLE_BUG_REPORTING", "true").lower() in ("true", "1", "yes")

    # Catalog Source & TMDB Settings (accepts both v3 32-hex api_key and v4 Bearer token)
    CATALOG_SOURCE: str = os.getenv("CATALOG_SOURCE", "local")  # "local" or "tmdb"
    TMDB_API_KEY: str = os.getenv("TMDB_API_KEY", "")
    TMDB_READ_TOKEN: str = os.getenv("TMDB_READ_TOKEN", "")
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p"
    TMDB_CACHE_TTL_SECONDS: int = 86400

    # Payments (Razorpay Test Mode)
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_cineverse123")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "secret_cineverse_test_mode")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "webhook_secret_cineverse_test")

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

    model_config = SettingsConfigDict(
        env_file=(_backend_env, _root_env, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()


def _classify_tmdb_string(raw: Optional[str]) -> tuple[str, str]:
    """
    Returns (mode, clean_value)
    mode is 'v4 bearer token', 'v3 api_key', or 'missing'
    """
    if not raw:
        return "missing", ""
    val = raw.strip()
    # Strip any enclosing quotes if present
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1].strip()
    if not val:
        return "missing", ""
    if val.startswith("Bearer "):
        val = val[7:].strip()
    if val.startswith("eyJ") or len(val) > 40:
        return "v4 bearer token", val
    if len(val) == 32 and bool(re.match(r"^[0-9a-fA-F]{32}$", val)):
        return "v3 api_key", val
    # Fallback: if 32 chars without strict hex or non-empty
    if len(val) == 32:
        return "v3 api_key", val
    return "missing", ""


def get_tmdb_auth_details(
    api_key: Optional[str] = None,
    read_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Auto-detects TMDB authentication mode across TMDB_API_KEY and TMDB_READ_TOKEN.
    Accepts:
    1. 32-character hex key -> query parameter `api_key=<key>`
    2. Long JWT token starting with 'eyJ' -> header `Authorization: Bearer <token>`
    Never prints or exposes the actual key or token in output.
    """
    raw_api_key = api_key if api_key is not None else (settings.TMDB_API_KEY or os.getenv("TMDB_API_KEY", ""))
    raw_read_token = read_token if read_token is not None else (settings.TMDB_READ_TOKEN or os.getenv("TMDB_READ_TOKEN", ""))

    mode_token, val_token = _classify_tmdb_string(raw_read_token)
    mode_key, val_key = _classify_tmdb_string(raw_api_key)

    chosen_mode = "missing"
    chosen_token = ""
    source_var = None

    if mode_token != "missing":
        chosen_mode = mode_token
        chosen_token = val_token
        source_var = "TMDB_READ_TOKEN"
    elif mode_key != "missing":
        chosen_mode = mode_key
        chosen_token = val_key
        source_var = "TMDB_API_KEY"
    else:
        # Check if any raw value was provided even if not standard format
        if raw_read_token.strip():
            chosen_mode = "v4 bearer token" if len(raw_read_token.strip()) > 40 else "v3 api_key"
            chosen_token = raw_read_token.strip()
            source_var = "TMDB_READ_TOKEN"
        elif raw_api_key.strip():
            chosen_mode = "v4 bearer token" if len(raw_api_key.strip()) > 40 else "v3 api_key"
            chosen_token = raw_api_key.strip()
            source_var = "TMDB_API_KEY"

    headers: Dict[str, str] = {}
    params: Dict[str, str] = {}

    if chosen_mode == "v4 bearer token":
        headers["Authorization"] = f"Bearer {chosen_token}"
    elif chosen_mode == "v3 api_key":
        params["api_key"] = chosen_token

    return {
        "mode": chosen_mode,
        "is_set": chosen_mode != "missing",
        "token": chosen_token,
        "value_length": len(chosen_token),
        "source_var": source_var,
        "headers": headers,
        "params": params,
        "env_file_loaded": settings.LOADED_ENV_PATH,
        "working_dir": settings.SERVER_WORKING_DIR,
    }


