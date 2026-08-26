from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships - these don't create columns, they define how
    # SQLAlchemy navigates between related objects in Python.
    # back_populates creates a bidirectional link: user.owned_boards
    # and board.owner both work.
    owned_boards: Mapped[list["Board"]] = relationship(  # noqa: F821
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    board_memberships: Mapped[list["BoardMember"]] = relationship(  # noqa: F821
        back_populates="user",
        cascade="all, delete-orphan",
    )
