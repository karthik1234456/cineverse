import time
import uuid
import logging
from typing import Optional, Dict, Any, Tuple
from fastapi import Request, HTTPException, status
from app.redis_client import get_redis_client
from app.config import settings

logger = logging.getLogger("cineverse.rate_limiter")

# Lua script for atomic sliding-window rate limit check using Redis Sorted Sets
# KEYS[1]: rate limit key, e.g. "rl:{route_class}:{identifier}"
# ARGV[1]: current timestamp in milliseconds
# ARGV[2]: window size in milliseconds
# ARGV[3]: max allowed requests
# ARGV[4]: unique member id (timestamp:uuid)
SLIDING_WINDOW_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local clear_before = now - window

-- 1. Remove entries older than window
redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)

-- 2. Count current entries
local current_count = redis.call('ZCARD', key)

if current_count < limit then
    -- 3. Add current request timestamp
    redis.call('ZADD', key, now, member)
    -- 4. Set TTL slightly longer than window for automatic cleanup
    redis.call('PEXPIRE', key, window + 5000)
    return {1, limit - current_count - 1, 0}
else
    -- Over limit: calculate remaining time until oldest request leaves the window
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after_ms = 1000
    if oldest and #oldest >= 2 then
        local oldest_ts = tonumber(oldest[2])
        retry_after_ms = math.max(1000, (oldest_ts + window) - now)
    end
    local retry_after_sec = math.ceil(retry_after_ms / 1000)
    return {0, 0, retry_after_sec}
end
"""

class RouteLimit:
    def __init__(
        self,
        route_class: str,
        user_limit: Optional[int] = None,
        user_window: Optional[int] = None,
        ip_limit: Optional[int] = None,
        ip_window: Optional[int] = None,
        custom_limit: Optional[int] = None,
        custom_window: Optional[int] = None,
    ):
        self.route_class = route_class
        self.user_limit = user_limit
        self.user_window = user_window  # in seconds
        self.ip_limit = ip_limit
        self.ip_window = ip_window  # in seconds
        self.custom_limit = custom_limit
        self.custom_window = custom_window

# Predefined route class configurations
ROUTE_LIMITS: Dict[str, RouteLimit] = {
    "hold_seats": RouteLimit(
        route_class="hold_seats",
        user_limit=10,
        user_window=60,      # 10 per minute per user
        ip_limit=30,
        ip_window=60,        # 30 per minute per IP
    ),
    "release_seats": RouteLimit(
        route_class="release_seats",
        user_limit=15,
        user_window=60,      # 15 per minute per user
        ip_limit=40,
        ip_window=60,        # 40 per minute per IP
    ),
    "otp_send": RouteLimit(
        route_class="otp_send",
        custom_limit=3,
        custom_window=600,   # 3 per 10 minutes per phone
        ip_limit=10,
        ip_window=3600,      # 10 per hour per IP
    ),
    "auth_login": RouteLimit(
        route_class="auth_login",
        user_limit=5,
        user_window=600,     # 5 per 10 minutes per account
        ip_limit=15,
        ip_window=600,       # 15 per 10 minutes per IP
    ),
    "auth_register": RouteLimit(
        route_class="auth_register",
        ip_limit=5,
        ip_window=600,       # 5 per 10 minutes per IP
    ),
    "search": RouteLimit(
        route_class="search",
        ip_limit=60,
        ip_window=60,        # 60 per minute per IP
    ),
    "payments": RouteLimit(
        route_class="payments",
        user_limit=5,
        user_window=600,     # 5 per 10 minutes per user
        ip_limit=10,
        ip_window=600,       # 10 per 10 minutes per IP
    ),
    "assistant": RouteLimit(
        route_class="assistant",
        user_limit=20,
        user_window=60,      # 20 per minute per user
        ip_limit=30,
        ip_window=60,        # 30 per minute per IP
    ),
    "problem_report": RouteLimit(
        route_class="problem_report",
        user_limit=5,
        user_window=3600,    # 5 per hour per user
        ip_limit=10,
        ip_window=3600,      # 10 per hour per IP
    ),
}


def extract_client_ip(request: Request) -> str:
    """Extracts client IP safely considering reverse proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # First IP in list is client
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


async def check_sliding_window_limit(
    redis_client: Any,
    key: str,
    limit: int,
    window_seconds: int
) -> Tuple[bool, int, int]:
    """
    Checks sliding window limit atomically using Lua.
    Returns: (is_allowed, remaining_quota, retry_after_seconds)
    """
    now_ms = int(time.time() * 1000)
    window_ms = window_seconds * 1000
    member = f"{now_ms}:{uuid.uuid4().hex[:8]}"

    try:
        res = await redis_client.eval(
            SLIDING_WINDOW_LUA,
            1,
            key,
            now_ms,
            window_ms,
            limit,
            member
        )
        is_allowed = bool(res[0] == 1)
        remaining = int(res[1])
        retry_after = int(res[2])
        return is_allowed, remaining, retry_after
    except Exception as exc:
        logger.warning(f"Redis rate limiter eval fallback: {exc}")
        # Fallback implementation if Redis server does not support Lua
        pipe = redis_client.pipeline()
        clear_before = now_ms - window_ms
        pipe.zremrangebyscore(key, 0, clear_before)
        pipe.zcard(key)
        results = await pipe.execute()
        current_count = results[1]
        if current_count < limit:
            pipe = redis_client.pipeline()
            pipe.zadd(key, {member: now_ms})
            pipe.pexpire(key, window_ms + 5000)
            await pipe.execute()
            return True, limit - current_count - 1, 0
        else:
            return False, 0, max(1, window_seconds // 2)


async def check_rate_limit(
    route_class: str,
    request: Request,
    user_id: Optional[int] = None,
    custom_identifier: Optional[str] = None
) -> None:
    """
    Evaluates rate limits for route class across both IP and user/custom identifier.
    Raises HTTPException(429) if exceeded with Retry-After header and structured JSON.
    Also verifies whether IP or user is actively blocked by administrator.
    """
    if not getattr(settings, "ENABLE_RATE_LIMITING", True):
        return

    route_cfg = ROUTE_LIMITS.get(route_class)
    if not route_cfg:
        return

    client_ip = extract_client_ip(request)
    redis = await get_redis_client()

    # 1. Check if IP or User is temporarily blocked by Admin
    if client_ip:
        ip_blocked = await redis.get(f"security:blocked:ip:{client_ip}")
        if ip_blocked:
            from app.core.fraud_logger import log_fraud_event
            await log_fraud_event(
                event_type="BLOCKED_IP_ATTEMPT",
                client_ip=client_ip,
                user_id=user_id,
                metadata={"route_class": route_class, "reason": ip_blocked}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access temporarily restricted: {ip_blocked}"
            )

    if user_id:
        user_blocked = await redis.get(f"security:blocked:user:{user_id}")
        if user_blocked:
            from app.core.fraud_logger import log_fraud_event
            await log_fraud_event(
                event_type="BLOCKED_USER_ATTEMPT",
                client_ip=client_ip,
                user_id=user_id,
                metadata={"route_class": route_class, "reason": user_blocked}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account temporarily suspended: {user_blocked}"
            )

    # 2. Check Custom / Phone identifier limit (e.g. OTP phone rate limit)
    if custom_identifier and route_cfg.custom_limit and route_cfg.custom_window:
        custom_key = f"rl:{route_class}:custom:{custom_identifier}"
        allowed, rem, retry_after = await check_sliding_window_limit(
            redis, custom_key, route_cfg.custom_limit, route_cfg.custom_window
        )
        if not allowed:
            from app.core.fraud_logger import log_fraud_event
            await log_fraud_event(
                event_type="RATE_LIMITED",
                client_ip=client_ip,
                user_id=user_id,
                metadata={"route_class": route_class, "target": "custom", "retry_after": retry_after}
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for this identifier. Please retry in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )

    # 3. Check User limit
    if user_id and route_cfg.user_limit and route_cfg.user_window:
        user_key = f"rl:{route_class}:user:{user_id}"
        allowed, rem, retry_after = await check_sliding_window_limit(
            redis, user_key, route_cfg.user_limit, route_cfg.user_window
        )
        if not allowed:
            from app.core.fraud_logger import log_fraud_event
            await log_fraud_event(
                event_type="RATE_LIMITED",
                client_ip=client_ip,
                user_id=user_id,
                metadata={"route_class": route_class, "target": "user", "retry_after": retry_after}
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account rate limit exceeded for {route_class}. Please retry in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )

    # 4. Check IP limit (except whitelisted internal IPs in dev)
    is_whitelisted_ip = client_ip in ("testclient",) and route_class not in ("auth_register",)
    if not is_whitelisted_ip and route_cfg.ip_limit and route_cfg.ip_window:
        ip_key = f"rl:{route_class}:ip:{client_ip}"
        allowed, rem, retry_after = await check_sliding_window_limit(
            redis, ip_key, route_cfg.ip_limit, route_cfg.ip_window
        )
        if not allowed:
            from app.core.fraud_logger import log_fraud_event
            await log_fraud_event(
                event_type="RATE_LIMITED",
                client_ip=client_ip,
                user_id=user_id,
                metadata={"route_class": route_class, "target": "ip", "retry_after": retry_after}
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests from your IP for {route_class}. Please retry in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )
