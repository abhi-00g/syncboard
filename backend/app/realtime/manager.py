from fastapi import WebSocket


class ConnectionManager:
    """Tracks WebSocket connections grouped by board.

    Internal structure: {board_id: {user_id: WebSocket}}

    Why a dict of dicts instead of a dict of lists?
    Because we need to:
    1. Check if a specific user is already connected (O(1) lookup)
    2. Remove a specific user on disconnect (O(1) removal)
    3. Exclude the actor when broadcasting (skip by user_id)
    A list would make all of these O(n).

    This is an in-memory data structure — it only knows about
    connections to THIS server instance. Redis pub/sub handles
    cross-instance communication.
    """

    def __init__(self):
        self._connections: dict[int, dict[int, WebSocket]] = {}

    async def connect(self, board_id: int, user_id: int, websocket: WebSocket):
        """Accept a WebSocket connection and track it under the board."""
        await websocket.accept()
        if board_id not in self._connections:
            self._connections[board_id] = {}
        self._connections[board_id][user_id] = websocket

    def disconnect(self, board_id: int, user_id: int):
        """Remove a connection. Returns True if this was the last
        connection for the board (so the caller can unsubscribe
        from Redis).
        """
        if board_id in self._connections:
            self._connections[board_id].pop(user_id, None)
            if not self._connections[board_id]:
                del self._connections[board_id]
                return True  # Last connection for this board
        return False

    async def broadcast_to_board(
        self,
        board_id: int,
        message: dict,
        exclude_user_id: int | None = None,
    ):
        """Send a message to all connected users on a board.

        exclude_user_id skips the actor — they already applied the
        change optimistically on their end. Sending it back would
        cause a duplicate update.

        If a send fails (broken connection), we collect the user_id
        and clean up after the loop. We don't modify the dict during
        iteration — that would raise RuntimeError.
        """
        if board_id not in self._connections:
            return

        disconnected = []
        for user_id, ws in self._connections[board_id].items():
            if user_id == exclude_user_id:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(user_id)

        for user_id in disconnected:
            self.disconnect(board_id, user_id)

    def get_connected_users(self, board_id: int) -> list[int]:
        """Get user IDs connected to a board on this instance."""
        if board_id not in self._connections:
            return []
        return list(self._connections[board_id].keys())

    def has_connections(self, board_id: int) -> bool:
        """Check if any users are connected to a board on this instance."""
        return board_id in self._connections and len(self._connections[board_id]) > 0


# Global singleton — shared across all request handlers in this process.
manager = ConnectionManager()
