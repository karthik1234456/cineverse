import os
from typing import List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Pre-load environment files safely in priority order
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_backend_dir, ".."))
_root_env = os.path.join(_root_dir, ".env")
_backend_env = os.path.join(_backend_dir, ".env")

if os.path.exists(_root_env):
    load_dotenv(_root_env, override=False)
if os.path.exists(_backend_env):
    load_dotenv(_backend_env, override=False)
load_dotenv(".env", override=False)



class Settings(BaseSettings):
    PROJECT_NAME: str = "CineVerse API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./cineverse.db"
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

    # Catalog Source & TMDB Settings
    CATALOG_SOURCE: str = os.getenv("CATALOG_SOURCE", "local")  # "local" or "tmdb"
    TMDB_API_KEY: str = os.getenv("TMDB_API_KEY", "")
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
        env_file=(_root_env, _backend_env, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

