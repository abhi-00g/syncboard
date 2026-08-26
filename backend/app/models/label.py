from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Label(Base):
    """A reusable label defined at the board level.

    Labels belong to a board, not to individual cards. This means
    the same "Bug" label (red) can be attached to multiple cards
    on that board. This mirrors Trello's design.
    """

    __tablename__ = "labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    name: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(20))  # e.g., "red", "blue", "#FF5733"

    board: Mapped["Board"] = relationship()  # noqa: F821


class CardLabel(Base):
    """Junction table linking cards to labels (many-to-many).

    A card can have multiple labels, and a label can be on multiple cards.
    """

    __tablename__ = "card_labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id"))
    label_id: Mapped[int] = mapped_column(ForeignKey("labels.id"))

    card: Mapped["Card"] = relationship(back_populates="labels")  # noqa: F821
    label: Mapped["Label"] = relationship()
