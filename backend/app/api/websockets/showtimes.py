import asyncio
import json
import logging
from typing import Dict, Set
from datetime import datetime, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from app.redis_client import get_redis_client
from app.config import settings

logger = logging.getLogger("cineverse.ws")
router = APIRouter()

# In-memory connection manager for active websockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, showtime_id: int, websocket: WebSocket):
        await websocket.accept()
        if showtime_id not in self.active_connections:
            self.active_connections[showtime_id] = set()
        self.active_connections[showtime_id].add(websocket)
        logger.info(f"WebSocket client connected to showtime {showtime_id}. Total: {len(self.active_connections[showtime_id])}")

    def disconnect(self, showtime_id: int, websocket: WebSocket):
        if showtime_id in self.active_connections:
            self.active_connections[showtime_id].discard(websocket)
            if not self.active_connections[showtime_id]:
                del self.active_connections[showtime_id]
        logger.info(f"WebSocket client disconnected from showtime {showtime_id}")

    async def broadcast_to_showtime(self, showtime_id: int, message: dict):
        if showtime_id in self.active_connections:
            dead_sockets = set()
            for ws in list(self.active_connections[showtime_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.disconnect(showtime_id, ws)


manager = ConnectionManager()


@router.websocket("/ws/showtimes/{showtime_id}")
async def websocket_showtime_endpoint(websocket: WebSocket, showtime_id: int):
    # Origin verification
    origin = websocket.headers.get("origin")
    allowed_origins = set(settings.CORS_ORIGINS) | {"http://localhost:3000", "http://127.0.0.1:3000"}
    if origin and origin not in allowed_origins and not origin.startswith("http://localhost:") and not origin.startswith("http://127.0.0.1:"):
        logger.warning(f"WebSocket connection rejected: invalid origin {origin}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(showtime_id, websocket)

    # Redis subscription listener task
    async def listen_redis():
        try:
            redis = await get_redis_client()
            pubsub = redis.pubsub()
            channel = f"ws:showtime:{showtime_id}"
            await pubsub.subscribe(channel)

            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    data = message.get("data")
                    if isinstance(data, str):
                        try:
                            parsed = json.loads(data)
                            await websocket.send_json(parsed)
                        except Exception:
                            await websocket.send_text(data)
                await asyncio.sleep(0.05)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"Redis pubsub error for showtime {showtime_id}: {e}")

    listener_task = asyncio.create_task(listen_redis())

    # Rate limiting counter per socket
    message_timestamps = []

    try:
        while True:
            # Receive text with maximum message size protection
            data = await websocket.receive_text()

            # Security: frame size limit (max 2048 bytes)
            if len(data) > 2048:
                logger.warning(f"WebSocket message exceeded max size: {len(data)} bytes")
                await websocket.close(code=1009)  # Message Too Big
                break

            # Security: client rate limit (max 60 messages/minute)
            now = datetime.utcnow()
            message_timestamps = [t for t in message_timestamps if t > now - timedelta(seconds=60)]
            if len(message_timestamps) >= 60:
                logger.warning(f"WebSocket client exceeded message rate limit")
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                break
            message_timestamps.append(now)

            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(showtime_id, websocket)
    except Exception as exc:
        logger.warning(f"WebSocket exception: {exc}")
        manager.disconnect(showtime_id, websocket)
    finally:
        listener_task.cancel()
