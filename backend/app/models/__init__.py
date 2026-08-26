# All models must be imported here so that Base.metadata contains
# every table definition. Alembic's autogenerate compares Base.metadata
# against the actual database schema to create migrations.
# If a model isn't imported here, Alembic won't know it exists.

from app.models.user import User
from app.models.board import Board, BoardMember
from app.models.column import Column
from app.models.card import Card
from app.models.label import Label, CardLabel
from app.models.comment import Comment
from app.models.activity import ActivityEvent

__all__ = [
    "User",
    "Board",
    "BoardMember",
    "Column",
    "Card",
    "Label",
    "CardLabel",
    "Comment",
    "ActivityEvent",
]
