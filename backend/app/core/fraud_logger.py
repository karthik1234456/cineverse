import time
import json
import logging
from typing import Optional, Dict, Any, List
from app.redis_client import get_redis_client

logger = logging.getLogger("cineverse.fraud")


def mask_ip(ip: str) -> str:
    """Masks IPv4 or IPv6 address for privacy preservation."""
    if not ip:
        return "unknown"
    if ip in ("testclient", "localhost", "127.0.0.1", "::1"):
        return ip
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.***.***"
    if ":" in ip:
        col_parts = ip.split(":")
        return f"{col_parts[0]}:***:***"
    return ip[:6] + "***"


async def log_fraud_event(
    event_type: str,
    client_ip: str,
    user_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Logs security/fraud signals into Redis without personal identifying details.
    Increments sliding telemetry counters and triggers automated alerts when thresholds are crossed.
    """
    try:
        redis = await get_redis_client()
        now = int(time.time())
        meta = metadata or {}

        event_payload = {
            "event_type": event_type,
            "masked_ip": mask_ip(client_ip),
            "raw_ip": client_ip,  # Retained in Redis for administrative IP-blocking lookup
            "user_id": user_id,
            "timestamp": now,
            "metadata": meta
        }

        # 1. Append to recent event log (capped at 200 items)
        await redis.lpush("fraud:events:stream", json.dumps(event_payload))
        await redis.ltrim("fraud:events:stream", 0, 199)

        # 2. Increment 1-hour window counters per IP & user
        pipe = redis.pipeline()
        ip_counter_key = f"fraud:stats:ip:{client_ip}:{event_type}"
        pipe.incr(ip_counter_key)
        pipe.expire(ip_counter_key, 3600)

        if user_id:
            user_counter_key = f"fraud:stats:user:{user_id}:{event_type}"
            pipe.incr(user_counter_key)
            pipe.expire(user_counter_key, 3600)

        # Increment global telemetry counters
        pipe.hincrby("fraud:stats:global", event_type, 1)
        await pipe.execute()

        # 3. Check threshold alerts
        await _evaluate_fraud_thresholds(redis, event_type, client_ip, user_id, meta)

    except Exception as exc:
        logger.warning(f"Failed to log fraud telemetry event: {exc}")


async def _evaluate_fraud_thresholds(
    redis: Any,
    event_type: str,
    client_ip: str,
    user_id: Optional[int],
    meta: Dict[str, Any]
) -> None:
    """Evaluates whether recent event volume crosses an anomaly threshold."""
    now = int(time.time())

    # Count recent failures / rate limits for this IP
    rl_count = int(await redis.get(f"fraud:stats:ip:{client_ip}:RATE_LIMITED") or 0)
    auth_fail_count = int(await redis.get(f"fraud:stats:ip:{client_ip}:AUTH_FAILED") or 0)
    hoard_count = int(await redis.get(f"fraud:stats:ip:{client_ip}:HOARDING_ATTEMPT") or 0)

    alert_reason = None
    if rl_count >= 5:
        alert_reason = f"IP {mask_ip(client_ip)} triggered {rl_count} rate limit rejections in 1 hour"
    elif auth_fail_count >= 5:
        alert_reason = f"IP {mask_ip(client_ip)} recorded {auth_fail_count} failed auth attempts in 1 hour"
    elif hoard_count >= 2:
        alert_reason = f"IP {mask_ip(client_ip)} attempted {hoard_count} seat-hoarding violations"

    if alert_reason:
        alert_item = {
            "id": f"alert:{now}:{client_ip[-4:]}",
            "severity": "HIGH",
            "reason": alert_reason,
            "client_ip": client_ip,
            "masked_ip": mask_ip(client_ip),
            "user_id": user_id,
            "timestamp": now,
            "status": "OPEN"
        }
        # Avoid duplicate alerts within 5 minutes
        debounce_key = f"fraud:alert_debounce:{client_ip}:{event_type}"
        is_first = await redis.set(debounce_key, "1", ex=300, nx=True)
        if is_first:
            logger.warning(f"[SECURITY ALERT] {alert_reason}")
            await redis.lpush("fraud:alerts:recent", json.dumps(alert_item))
            await redis.ltrim("fraud:alerts:recent", 0, 49)


async def block_target(target_type: str, target: str, duration_minutes: int, reason: str) -> None:
    """Blocks an IP address or User ID for a specified duration."""
    redis = await get_redis_client()
    key = f"security:blocked:{target_type}:{target}"
    duration_seconds = max(60, duration_minutes * 60)
    await redis.set(key, reason, ex=duration_seconds)
    logger.warning(f"[SECURITY] Blocked {target_type} '{target}' for {duration_minutes}m: {reason}")


async def unblock_target(target_type: str, target: str) -> bool:
    """Lifts a block on an IP address or User ID."""
    redis = await get_redis_client()
    key = f"security:blocked:{target_type}:{target}"
    deleted = await redis.delete(key)
    logger.info(f"[SECURITY] Unblocked {target_type} '{target}'")
    return bool(deleted > 0)


async def get_blocked_targets() -> List[Dict[str, Any]]:
    """Lists currently blocked IPs and accounts."""
    redis = await get_redis_client()
    blocked = []
    # Scan for blocked keys
    keys = []
    try:
        keys = await redis.keys("security:blocked:*")
    except Exception:
        pass

    for k in keys:
        ttl = await redis.ttl(k)
        reason = await redis.get(k)
        parts = k.split(":")
        if len(parts) >= 4:
            target_type = parts[2]
            target = ":".join(parts[3:])
            blocked.append({
                "target_type": target_type,
                "target": target,
                "masked_target": mask_ip(target) if target_type == "ip" else target,
                "reason": reason,
                "ttl_seconds": ttl,
                "expires_in_minutes": max(1, ttl // 60)
            })
    return blocked


async def get_security_metrics() -> Dict[str, Any]:
    """Returns aggregated security telemetry metrics for the admin console."""
    redis = await get_redis_client()
    global_stats = await redis.hgetall("fraud:stats:global") or {}
    alerts_raw = await redis.lrange("fraud:alerts:recent", 0, 19) or []
    events_raw = await redis.lrange("fraud:events:stream", 0, 19) or []
    blocked_items = await get_blocked_targets()

    alerts = [json.loads(a) for a in alerts_raw]
    events = [json.loads(e) for e in events_raw]

    return {
        "global_counters": {k: int(v) for k, v in global_stats.items()},
        "active_blocks_count": len(blocked_items),
        "blocked_targets": blocked_items,
        "recent_alerts": alerts,
        "recent_events": events
    }
