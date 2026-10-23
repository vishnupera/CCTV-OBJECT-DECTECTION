"""WebSocket connection manager for real-time alerts."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List, Set

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self):
        self._connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)
        logger.info("WebSocket connected. Total: %d", len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections = [c for c in self._connections if c != ws]
        logger.info("WebSocket disconnected. Total: %d", len(self._connections))

    async def broadcast(self, data: Dict[str, Any]) -> None:
        msg = json.dumps(data, default=str)
        dead = []
        async with self._lock:
            connections = list(self._connections)
        for ws in connections:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_to(self, ws: WebSocket, data: Dict[str, Any]) -> None:
        try:
            await ws.send_text(json.dumps(data, default=str))
        except Exception:
            await self.disconnect(ws)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Singleton
_manager = ConnectionManager()


def get_ws_manager() -> ConnectionManager:
    return _manager
