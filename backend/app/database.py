from typing import AsyncGenerator
from sqlalchemy import event
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

# Engine configuration
connect_args = {}
engine_kwargs = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False
    connect_args["timeout"] = 60.0  # 60s busy timeout for high-concurrency sqlite
    engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args if connect_args else {},
    **engine_kwargs
)

if "sqlite" in settings.DATABASE_URL:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=60000")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Check cinema columns
        try:
            res = await conn.execute(text("PRAGMA table_info(cinemas)"))
            cinema_cols = [r[1] for r in res.fetchall()]
        except Exception:
            cinema_cols = []

        new_cinema_cols = [
            ("pincode", "VARCHAR(10)"),
            ("landmark", "VARCHAR(200)"),
            ("parking", "VARCHAR(50) DEFAULT 'Covered'"),
            ("transit_stop", "VARCHAR(200)"),
            ("phone", "VARCHAR(50) DEFAULT '+91 80 4000 1234'"),
            ("opening_hours", "VARCHAR(100) DEFAULT '09:00 AM - 11:30 PM'"),
            ("is_demo_data", "BOOLEAN DEFAULT 1"),
        ]
        for col_name, col_def in new_cinema_cols:
            if cinema_cols and col_name not in cinema_cols:
                try:
                    await conn.execute(text(f"ALTER TABLE cinemas ADD COLUMN {col_name} {col_def}"))
                except Exception:
                    pass

        # Check movie columns
        try:
            res = await conn.execute(text("PRAGMA table_info(movies)"))
            existing_movie_cols = [r[1] for r in res.fetchall()]
        except Exception:
            existing_movie_cols = []

        movie_cols = [
            ("dominant_color", "VARCHAR(32)"),
            ("glimpse_url", "VARCHAR(500)"),
            ("glimpse_webm_url", "VARCHAR(500)"),
            ("glimpse_720p_url", "VARCHAR(500)"),
            ("tmdb_id", "INTEGER"),
            ("tmdb_vote_average", "FLOAT"),
            ("tmdb_popularity", "FLOAT"),
            ("is_tmdb", "BOOLEAN DEFAULT 0"),
            ("youtube_trailer_id", "VARCHAR(50)"),
        ]
        for col_name, col_def in movie_cols:
            if existing_movie_cols and col_name not in existing_movie_cols:
                try:
                    await conn.execute(text(f"ALTER TABLE movies ADD COLUMN {col_name} {col_def}"))
                except Exception:
                    pass


async def reset_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
