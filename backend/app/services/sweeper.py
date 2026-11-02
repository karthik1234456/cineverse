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
            for s in expired_seats:
                by_showtime.setdefault(s.showtime_id, []).append(s.seat_id)
                s.status = SeatStatusEnum.AVAILABLE
                s.hold_id = None
                s.hold_expires_at = None
                s.held_by_user_id = None

            await db.commit()

            # Broadcast releases
            for showtime_id, seat_ids in by_showtime.items():
                await broadcast_seat_update(showtime_id, {
                    "event": "SEATS_EXPIRED",
                    "showtime_id": showtime_id,
                    "seat_ids": seat_ids,
                    "status": "AVAILABLE"
                })

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

