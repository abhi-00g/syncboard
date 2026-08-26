from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
    )

    owner: Mapped["User"] = relationship(back_populates="owned_boards")  # noqa: F821
    members: Mapped[list["BoardMember"]] = relationship(
        back_populates="board",
        cascade="all, delete-orphan",
    )
    columns: Mapped[list["Column"]] = relationship(  # noqa: F821
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="Column.position",
    )


class BoardMember(Base):
    """Junction table for many-to-many relationship between users and boards.

    A user can be a member of many boards, and a board can have many members.
    The `role` field distinguishes owners from regular members, which we'll
    use for authorization (only owners can delete boards or remove members).
    """

    __tablename__ = "board_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(20), default="member")  # "owner" or "member"
    joined_at: Mapped[datetime] = mapped_column(server_default=func.now())

    board: Mapped["Board"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="board_memberships")  # noqa: F821
