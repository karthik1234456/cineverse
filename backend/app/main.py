import asyncio
import time
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.seed.seeder import seed_database
from app.services.sweeper import start_sweeper_task
from app.redis_client import close_redis_client, get_redis_client

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
from app.api.v1.search import router as search_router
from app.api.v1.agent import router as agent_router
from app.api.v1.operations.onboarding import router as onboarding_router
from app.api.v1.operations.scanning import router as scanning_router
from app.api.v1.operations.food import router as food_router
from app.api.v1.operations.loyalty import router as loyalty_router
from app.api.v1.operations.transfer import router as transfer_router
from app.api.websockets.showtimes import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
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


def create_app() -> FastAPI:
    """FastAPI application factory."""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Full Production Movie Booking & 3D Seat Preview Platform API",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan
    )

    # 1. CORS Middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Request ID & Structured Logging Middleware
    @application.middleware("http")
    async def request_id_and_logging_middleware(request: Request, call_next):
        req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = req_id
        start_time = time.perf_counter()

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(f"[REQ {req_id}] Unhandled error: {exc} ({request.method} {request.url.path} - {duration_ms}ms)")
            raise

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = req_id
        logger.info(f"[REQ {req_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)")
        return response

    # 3. Standardized Error Handlers
    @application.exception_handler(HTTPException)
    async def custom_http_exception_handler(request: Request, exc: HTTPException):
        req_id = getattr(request.state, "request_id", None)
        headers = {"X-Request-ID": req_id} if req_id else None
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail),
                    "request_id": req_id
                },
                "detail": exc.detail
            },
            headers=headers
        )

    # 4. Health & Readiness Probes
    @application.get("/health", tags=["Health & Observability"])
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

    @application.get("/ready", tags=["Health & Observability"])
    async def readiness_check():
        db_status = "connected"
        redis_status = "connected"
        is_ready = True

        # Check DB
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
        except Exception as exc:
            db_status = f"unhealthy: {exc}"
            is_ready = False

        # Check Redis
        try:
            r = await get_redis_client()
            pong = await r.ping()
            if not pong:
                redis_status = "unresponsive"
                is_ready = False
        except Exception as exc:
            redis_status = f"unhealthy: {exc}"
            is_ready = False

        status_code = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "ready" if is_ready else "degraded",
                "database": db_status,
                "redis": redis_status,
                "version": settings.VERSION
            }
        )

    # 5. Include API Routers
    v1 = settings.API_V1_PREFIX
    application.include_router(auth_router, prefix=f"{v1}/auth", tags=["Authentication"])
    application.include_router(cities_router, prefix=f"{v1}/cities", tags=["Cities"])
    application.include_router(movies_router, prefix=f"{v1}/movies", tags=["Movies"])
    application.include_router(cinemas_router, prefix=f"{v1}/cinemas", tags=["Cinemas"])
    application.include_router(auditoriums_router, prefix=f"{v1}/auditoriums", tags=["Auditoriums"])
    application.include_router(showtimes_router, prefix=f"{v1}/showtimes", tags=["Showtimes"])
    application.include_router(bookings_router, prefix=f"{v1}/bookings", tags=["Bookings & Holds"])
    application.include_router(addons_router, prefix=f"{v1}/addons", tags=["F&B Addons"])
    application.include_router(coupons_router, prefix=f"{v1}/coupons", tags=["Coupons & Offers"])
    application.include_router(payments_router, prefix=f"{v1}/payments", tags=["Payments"])
    application.include_router(tickets_router, prefix=f"{v1}/tickets", tags=["Tickets"])
    application.include_router(search_router, prefix=f"{v1}/search", tags=["Global Search"])
    application.include_router(admin_router, prefix=f"{v1}/admin", tags=["Admin"])
    application.include_router(agent_router, prefix=f"{v1}/agent", tags=["Voice Agent"])
    application.include_router(onboarding_router)
    application.include_router(scanning_router)
    application.include_router(food_router)
    application.include_router(loyalty_router)
    application.include_router(transfer_router)
    application.include_router(ws_router, tags=["WebSockets"])

    return application


app = create_app()
