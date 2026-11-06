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
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate Phase 6 map columns on cinemas table if missing (SQLite / PostgreSQL safe)
        from sqlalchemy import text
        new_cols = [
            ("pincode", "VARCHAR(10)"),
            ("landmark", "VARCHAR(200)"),
            ("parking", "VARCHAR(50) DEFAULT 'Covered'"),
            ("transit_stop", "VARCHAR(200)"),
            ("phone", "VARCHAR(50) DEFAULT '+91 80 4000 1234'"),
            ("opening_hours", "VARCHAR(100) DEFAULT '09:00 AM - 11:30 PM'"),
            ("is_demo_data", "BOOLEAN DEFAULT 1"),
        ]
        for col_name, col_def in new_cols:
            try:
                await conn.execute(text(f"ALTER TABLE cinemas ADD COLUMN {col_name} {col_def}"))
            except Exception:
                # Column already exists
                pass


async def reset_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
