from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Card(Base):
    """A task card that lives in a column.

    The `version` field is the core of optimistic concurrency control.
    Every update increments it. When a client sends an update, it
    includes the version it's editing. If the server's version is
    higher, the update is rejected — meaning someone else edited it
    first. This prevents lost updates without using database locks.

    The `position` field works like Column.position — it determines
    the card's vertical position within its column.
    """

    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("columns.id"))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
    )

    column: Mapped["Column"] = relationship(back_populates="cards")  # noqa: F821
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])  # noqa: F821
    assignee: Mapped[Optional["User"]] = relationship(  # noqa: F821
        foreign_keys=[assigned_to]
    )
    labels: Mapped[list["CardLabel"]] = relationship(
        back_populates="card",
        cascade="all, delete-orphan",
    )
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        back_populates="card",
        cascade="all, delete-orphan",
        order_by="Comment.created_at",
    )
