import json
from typing import Dict, List, Set
from fastapi import WebSocket


class GroupConnectionManager:
    """Manages active WebSockets for real-time group seat selection and presence."""
    def __init__(self):
        # group_id -> set of WebSocket connections
        self.active_groups: Dict[int, Set[WebSocket]] = {}
        # ws -> user metadata { user_id, user_name, initials, color }
        self.ws_metadata: Dict[WebSocket, dict] = {}

    async def connect(self, ws: WebSocket, group_id: int, user_meta: dict):
        await ws.accept()
        if group_id not in self.active_groups:
            self.active_groups[group_id] = set()
        self.active_groups[group_id].add(ws)
        self.ws_metadata[ws] = user_meta

        # Broadcast member join presence
        await self.broadcast_to_group(group_id, {
            "type": "PRESENCE_JOIN",
            "user": user_meta
        })

    def disconnect(self, ws: WebSocket, group_id: int):
        meta = self.ws_metadata.pop(ws, None)
        if group_id in self.active_groups:
            self.active_groups[group_id].discard(ws)
            if not self.active_groups[group_id]:
                del self.active_groups[group_id]
        return meta

    async def broadcast_to_group(self, group_id: int, message: dict):
        if group_id not in self.active_groups:
            return
        payload = json.dumps(message)
        dead_connections = set()
        for connection in self.active_groups[group_id]:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.add(connection)

        for dead in dead_connections:
            self.disconnect(dead, group_id)


group_ws_manager = GroupConnectionManager()
