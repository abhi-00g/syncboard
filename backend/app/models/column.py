from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Column(Base):
    """A vertical lane on a board (e.g., 'To Do', 'In Progress', 'Done').

    The `position` field determines display order. When a user reorders
    columns by dragging, we update position values. Using integers means
    reordering requires updating multiple rows (shifting positions), but
    it's simple, predictable, and what Trello does internally.
    """

    __tablename__ = "columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    name: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    board: Mapped["Board"] = relationship(back_populates="columns")  # noqa: F821
    cards: Mapped[list["Card"]] = relationship(  # noqa: F821
        back_populates="column",
        cascade="all, delete-orphan",
        order_by="Card.position",
    )
