import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.seed.seeder import seed_database
from app.services.sweeper import start_sweeper_task
from app.redis_client import close_redis_client

# Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.cities import router as cities_router
from app.api.v1.movies import router as movies_router
from app.api.v1.cinemas import router as cinemas_router
from app.api.v1.auditoriums import router as auditoriums_router
from app.api.v1.showtimes import router as showtimes_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.addons import router as addons_router
from app.api.v1.coupons import router as coupons_router
from app.api.v1.payments import router as payments_router
from app.api.v1.tickets import router as tickets_router
from app.api.v1.admin import router as admin_router
from app.api.websockets.showtimes import router as ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cineverse.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()
    try:
        await seed_database()
    except Exception as exc:
        logger.warning(f"Seed step notice: {exc}")

    # Launch background sweeper task for expired holds
    sweeper_task = asyncio.create_task(start_sweeper_task(interval_seconds=10))
    yield
    sweeper_task.cancel()
    await close_redis_client()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Full Production Movie Booking & 3D Seat Preview Platform API",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "CineVerse API",
        "version": settings.VERSION,
        "features": {
            "3d_auditorium": True,
            "real_time_holds": True,
            "razorpay_payments": True,
            "signed_qr_tickets": True
        }
    }


# Include Routers
v1 = settings.API_V1_PREFIX
app.include_router(auth_router, prefix=f"{v1}/auth", tags=["Authentication"])
app.include_router(cities_router, prefix=f"{v1}/cities", tags=["Cities"])
app.include_router(movies_router, prefix=f"{v1}/movies", tags=["Movies"])
app.include_router(cinemas_router, prefix=f"{v1}/cinemas", tags=["Cinemas"])
app.include_router(auditoriums_router, prefix=f"{v1}/auditoriums", tags=["Auditoriums"])
app.include_router(showtimes_router, prefix=f"{v1}/showtimes", tags=["Showtimes"])
app.include_router(bookings_router, prefix=f"{v1}/bookings", tags=["Bookings & Holds"])
app.include_router(addons_router, prefix=f"{v1}/addons", tags=["F&B Addons"])
app.include_router(coupons_router, prefix=f"{v1}/coupons", tags=["Coupons & Offers"])
app.include_router(payments_router, prefix=f"{v1}/payments", tags=["Payments"])
app.include_router(tickets_router, prefix=f"{v1}/tickets", tags=["Tickets"])
app.include_router(admin_router, prefix=f"{v1}/admin", tags=["Admin"])
app.include_router(ws_router, tags=["WebSockets"])

