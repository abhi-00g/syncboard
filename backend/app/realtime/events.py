from datetime import datetime, timezone

from app.realtime.pubsub import redis_service


async def broadcast_event(
    board_id: int,
    event_type: str,
    data: dict,
    actor_id: int,
):
    """Publish an event to a board's Redis channel.

    This is the function REST routers call after every mutation.
    It wraps the event data in a standard envelope with metadata
    that every client can rely on:

    {
        "type": "card_moved",
        "board_id": 1,
        "actor_id": 5,
        "data": { ... event-specific payload ... },
        "timestamp": "2026-08-26T18:00:00Z"
    }

    actor_id is used by the listener to skip broadcasting back
    to the user who caused the event (they already applied the
    change optimistically).
    """
    event = {
        "type": event_type,
        "board_id": board_id,
        "actor_id": actor_id,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await redis_service.publish(board_id, event)


# ──────────────────────────────────────────────
# Event type constants
# ──────────────────────────────────────────────
# Using constants instead of raw strings prevents typos
# and makes it easy to see all event types in one place.

# Card events
CARD_CREATED = "card_created"
CARD_UPDATED = "card_updated"
CARD_MOVED = "card_moved"
CARD_DELETED = "card_deleted"

# Comment events
COMMENT_ADDED = "comment_added"
COMMENT_DELETED = "comment_deleted"

# Label events
LABEL_CREATED = "label_created"
LABEL_DELETED = "label_deleted"
LABEL_ATTACHED = "label_attached"
LABEL_REMOVED = "label_removed"

# Column events
COLUMN_CREATED = "column_created"
COLUMN_UPDATED = "column_updated"
COLUMN_DELETED = "column_deleted"

# Board events
BOARD_UPDATED = "board_updated"
MEMBER_ADDED = "member_added"

# Presence events
USER_JOINED = "user_joined"
USER_LEFT = "user_left"
