from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Comment(Base):
    """A comment on a card.

    Comments are interesting in this project because they'll be
    real-time — when someone adds a comment, every user viewing
    that card sees it appear instantly via WebSocket. So even
    though comments look like simple CRUD, they flow through
    the same event system as card moves.
    """

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
    )

    card: Mapped["Card"] = relationship(back_populates="comments")  # noqa: F821
    user: Mapped["User"] = relationship()  # noqa: F821
