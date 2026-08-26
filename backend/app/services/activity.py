import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity import ActivityEvent


async def log_activity(
    db: AsyncSession,
    board_id: int,
    user_id: int,
    event_type: str,
    entity_type: str,
    entity_id: int,
    detail: dict,
) -> ActivityEvent:
    """Persist an activity event to the database.

    This is called alongside broadcast_event in every router mutation.
    broadcast_event sends the event in real-time via Redis/WebSocket.
    log_activity persists it so the frontend can show historical activity.

    The detail field stores event-specific data as a JSON string.
    We use JSON instead of separate columns because each event type
    has different data (card_moved has from/to columns, comment_added
    has content, etc.). This is a common pattern for event stores —
    a fixed envelope (who, what, when) with a flexible payload.
    """
    event = ActivityEvent(
        board_id=board_id,
        user_id=user_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=json.dumps(detail),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_board_activity(
    db: AsyncSession,
    board_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[ActivityEvent]:
    """Get recent activity for a board, newest first.

    Paginated with limit/offset. The frontend loads the first page
    on board open, then can load more as the user scrolls.
    """
    result = await db.execute(
        select(ActivityEvent)
        .where(ActivityEvent.board_id == board_id)
        .options(selectinload(ActivityEvent.user))
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
