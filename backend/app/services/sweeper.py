import asyncio
import logging
from datetime import datetime
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.showtime import SeatInventory, SeatStatusEnum
from app.services.hold_service import broadcast_seat_update

logger = logging.getLogger("cineverse.sweeper")


async def sweep_expired_holds():
    """Scans for expired seat holds and reverts them to AVAILABLE."""
    try:
        async with AsyncSessionLocal() as db:
            now = datetime.utcnow()
            stmt = select(SeatInventory).where(
                SeatInventory.status == SeatStatusEnum.HELD,
                SeatInventory.hold_expires_at <= now
            )
            result = await db.execute(stmt)
            expired_seats = result.scalars().all()

            if not expired_seats:
                return 0

            # Group by showtime_id for websocket notification
            by_showtime = {}
            holds_expired = set()
            for s in expired_seats:
                by_showtime.setdefault(s.showtime_id, []).append(s.seat_id)
                if s.hold_id:
                    holds_expired.add((s.hold_id, s.held_by_user_id))
                s.status = SeatStatusEnum.AVAILABLE
                s.hold_id = None
                s.hold_expires_at = None
                s.held_by_user_id = None

            await db.commit()

            # Track expired holds for hoarding cooldown & telemetry
            try:
                from app.redis_client import get_redis_client
                from app.core.fraud_logger import log_fraud_event
                from app.config import settings

                redis = await get_redis_client()
                for h_id, u_id in holds_expired:
                    ip = await redis.get(f"hold:meta:ip:{h_id}")
                    if ip:
                        await redis.srem(f"hoard:ip_holds:{ip}", h_id)
                        ip_exp_key = f"fraud:expired_holds:ip:{ip}"
                        cnt = await redis.incr(ip_exp_key)
                        await redis.expire(ip_exp_key, getattr(settings, "EXPIRED_HOLDS_WINDOW_SECONDS", 1800))
                        if cnt >= getattr(settings, "EXPIRED_HOLDS_COOLDOWN_THRESHOLD", 3):
                            await redis.setex(
                                f"fraud:cooldown:ip:{ip}",
                                getattr(settings, "COOLDOWN_DURATION_SECONDS", 900),
                                "1"
                            )
                        await log_fraud_event("HOLD_EXPIRED", ip, u_id, {"hold_id": h_id})

                    if u_id:
                        user_exp_key = f"fraud:expired_holds:user:{u_id}"
                        cnt = await redis.incr(user_exp_key)
                        await redis.expire(user_exp_key, getattr(settings, "EXPIRED_HOLDS_WINDOW_SECONDS", 1800))
                        if cnt >= getattr(settings, "EXPIRED_HOLDS_COOLDOWN_THRESHOLD", 3):
                            await redis.setex(
                                f"fraud:cooldown:user:{u_id}",
                                getattr(settings, "COOLDOWN_DURATION_SECONDS", 900),
                                "1"
                            )
                        if not ip:
                            await log_fraud_event("HOLD_EXPIRED", "127.0.0.1", u_id, {"hold_id": h_id})
            except Exception as exp_track_err:
                logger.warning(f"Error updating expired hold tracking: {exp_track_err}")

            # Broadcast releases and process waitlist
            for showtime_id, seat_ids in by_showtime.items():
                await broadcast_seat_update(showtime_id, {
                    "event": "SEATS_EXPIRED",
                    "showtime_id": showtime_id,
                    "seat_ids": seat_ids,
                    "status": "AVAILABLE"
                })
                try:
                    from app.services.waitlist_service import process_waitlist_on_release
                    await process_waitlist_on_release(db, showtime_id, len(seat_ids))
                except Exception as w_exc:
                    logger.warning(f"Error processing waitlist on sweep for showtime {showtime_id}: {w_exc}")

            logger.info(f"Sweeper reverted {len(expired_seats)} expired seats across {len(by_showtime)} showtimes")
            return len(expired_seats)
    except Exception as exc:
        logger.error(f"Error during expired holds sweep: {exc}")
        return 0


async def start_sweeper_task(interval_seconds: int = 15):
    """Background task running continuously while server is alive."""
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await sweep_expired_holds()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error(f"Sweeper task exception: {exc}")

