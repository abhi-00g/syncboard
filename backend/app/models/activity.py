from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ActivityEvent(Base):
    """A persisted record of something that happened on a board.

    This is the event log / audit trail. Every significant action
    (card created, card moved, comment added, member joined) gets
    recorded here. The activity sidebar on the frontend queries
    this table to show recent board activity.

    In interview terms, this is a simplified event store. The same
    events that flow through Redis pub/sub for real-time delivery
    also get persisted here for historical viewing. You can explain
    this as "event sourcing lite" — we're not rebuilding state from
    events, but we are storing the event stream alongside the state.
    """

    __tablename__ = "activity_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(50))  # "card_created", "card_moved", etc.
    entity_type: Mapped[str] = mapped_column(String(50))  # "card", "column", "comment"
    entity_id: Mapped[int] = mapped_column()
    detail: Mapped[str] = mapped_column(Text)  # JSON string with event-specific data
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship()  # noqa: F821
