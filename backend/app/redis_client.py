import logging
from typing import Optional, Any
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger("cineverse.redis")

_redis_instance: Optional[Any] = None


async def get_redis_client() -> Any:
    global _redis_instance
    if _redis_instance is not None:
        return _redis_instance

    try:
        # Attempt connection to configured Redis server
        client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=0.5,
            socket_connect_timeout=0.5
        )
        await client.ping()
        logger.info(f"Connected to live Redis at {settings.REDIS_URL}")
        _redis_instance = client
        return _redis_instance
    except Exception as exc:
        logger.warning(f"Could not connect to Redis ({exc}). Falling back to fakeredis in-memory store.")
        try:
            import fakeredis.aioredis as fake_aioredis
            _redis_instance = fake_aioredis.FakeRedis(decode_responses=True)
            return _redis_instance
        except Exception as f_err:
            logger.error(f"Fakeredis initialization failed: {f_err}")
            raise


async def close_redis_client():
    global _redis_instance
    if _redis_instance is not None:
        try:
            await _redis_instance.aclose()
        except Exception:
            pass
        _redis_instance = None

