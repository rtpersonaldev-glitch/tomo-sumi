from collections import defaultdict

from fastapi import WebSocket


class ChatConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, home_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[home_id].append(websocket)

    def disconnect(self, home_id: int, websocket: WebSocket) -> None:
        conns = self._connections.get(home_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, home_id: int, message: dict) -> None:
        disconnected = []
        for ws in self._connections.get(home_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(home_id, ws)


manager = ChatConnectionManager()
