import asyncio
import json

import redis.asyncio as aioredis

from app.config import settings
from app.realtime.manager import manager


class RedisPubSubService:
    """Redis pub/sub for cross-instance broadcasting + presence.

    Two Redis connections are used:
    1. self._redis — general commands (publish, presence get/set/delete)
    2. self._pubsub — dedicated subscription listener

    Why two connections? A Redis connection in subscribe mode can ONLY
    receive subscription messages. It can't run GET, SET, or PUBLISH.
    So we need a separate connection for regular commands.
    """

    PRESENCE_TTL = 30  # seconds before a user is considered offline
    HEARTBEAT_INTERVAL = 15  # client sends heartbeat every 15s

    def __init__(self):
        self._redis: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None
        self._listener_task: asyncio.Task | None = None
        self._subscribed_channels: set[str] = set()

    async def connect(self):
        """Initialize Redis connections. Called once at app startup."""
        self._redis = aioredis.from_url(
            settings.REDIS_URL, decode_responses=True
        )
        self._pubsub = self._redis.pubsub()

    async def disconnect(self):
        """Clean shutdown. Called at app shutdown."""
        if self._listener_task and not self._listener_task.done():
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()

    # ──────────────────────────────────────────────
    # Pub/Sub
    # ──────────────────────────────────────────────

    def _channel_name(self, board_id: int) -> str:
        """Channel naming convention: board:{id}:events"""
        return f"board:{board_id}:events"

    async def publish(self, board_id: int, event: dict):
        """Publish an event to a board's Redis channel.

        This is called after every mutation (card created, card moved,
        comment added, etc). Every server instance subscribed to this
        channel receives the event and forwards it to their local
        WebSocket connections.
        """
        if self._redis:
            channel = self._channel_name(board_id)
            await self._redis.publish(channel, json.dumps(event))

    async def subscribe_board(self, board_id: int):
        """Subscribe to a board's event channel.

        Called when the first WebSocket connects to a board on this
        instance. If no one on this instance is watching board 5,
        there's no reason to receive its events from Redis.
        """
        channel = self._channel_name(board_id)
        if channel not in self._subscribed_channels:
            await self._pubsub.subscribe(channel)
            self._subscribed_channels.add(channel)

            # Start the listener if not running
            if self._listener_task is None or self._listener_task.done():
                self._listener_task = asyncio.create_task(self._listen())

    async def unsubscribe_board(self, board_id: int):
        """Unsubscribe from a board's channel.

        Called when the last WebSocket for a board disconnects
        from this instance.
        """
        channel = self._channel_name(board_id)
        if channel in self._subscribed_channels:
            await self._pubsub.unsubscribe(channel)
            self._subscribed_channels.discard(channel)

    async def _listen(self):
        """Background task: receive Redis messages and dispatch to WebSockets.

        This runs for the lifetime of the server. It reads messages
        from all subscribed channels and forwards them to the
        ConnectionManager for local broadcasting.

        The flow:
        Redis message arrives → parse JSON → extract board_id from
        channel name → broadcast to local WebSocket connections
        (excluding the actor who caused the event).
        """
        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue  # skip subscribe/unsubscribe confirmations

                try:
                    channel = message["channel"]
                    data = json.loads(message["data"])

                    # Extract board_id from channel "board:1:events"
                    board_id = int(channel.split(":")[1])

                    # Forward to local WebSocket connections
                    await manager.broadcast_to_board(
                        board_id=board_id,
                        message=data,
                        exclude_user_id=data.get("actor_id"),
                    )
                except (json.JSONDecodeError, IndexError, ValueError) as e:
                    print(f"Error processing Redis message: {e}")

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Redis listener crashed: {e}")
            # In production, you'd want retry logic here.
            # For now, the server continues without real-time
            # updates until restarted.

    # ──────────────────────────────────────────────
    # Presence
    # ──────────────────────────────────────────────

    async def set_presence(self, board_id: int, user_id: int):
        """Mark a user as online on a board.

        SETEX sets the key with a TTL. If the key already exists,
        it overwrites both the value and the TTL. The TTL acts as
        an automatic cleanup — if the client stops sending heartbeats,
        the key expires and the user disappears from the presence list.
        """
        if self._redis:
            key = f"presence:board:{board_id}:user:{user_id}"
            await self._redis.setex(key, self.PRESENCE_TTL, "online")

    async def remove_presence(self, board_id: int, user_id: int):
        """Explicitly remove a user's presence (on clean disconnect)."""
        if self._redis:
            key = f"presence:board:{board_id}:user:{user_id}"
            await self._redis.delete(key)

    async def refresh_presence(self, board_id: int, user_id: int):
        """Reset the TTL on a user's presence key.

        Called every time the client sends a heartbeat. This keeps
        the key alive. If the client disappears without sending a
        disconnect, the key expires after PRESENCE_TTL seconds.
        """
        await self.set_presence(board_id, user_id)

    async def get_present_users(self, board_id: int) -> list[int]:
        """Get all users currently online on a board.

        Uses SCAN (not KEYS) to find matching keys. SCAN is O(1)
        per call and iterates incrementally. KEYS would block
        Redis while scanning the entire keyspace.
        """
        if not self._redis:
            return []

        pattern = f"presence:board:{board_id}:user:*"
        user_ids = []
        async for key in self._redis.scan_iter(match=pattern):
            try:
                user_id = int(key.split(":")[-1])
                user_ids.append(user_id)
            except (ValueError, IndexError):
                continue
        return user_ids


# Global singleton
redis_service = RedisPubSubService()
