from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ColumnCreate(BaseModel):
    name: str
    position: Optional[int] = None  # Auto-assigned if not provided


class ColumnUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[int] = None


class ColumnResponse(BaseModel):
    id: int
    board_id: int
    name: str
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CardBriefResponse(BaseModel):
    """Card summary for board view (not the full detail)."""

    id: int
    column_id: int
    title: str
    position: int
    version: int
    assigned_to: Optional[int] = None
    due_date: Optional[datetime] = None
    label_count: int = 0
    comment_count: int = 0

    model_config = {"from_attributes": True}


class ColumnWithCardsResponse(BaseModel):
    """Column with its cards — used in the full board response."""

    id: int
    board_id: int
    name: str
    position: int
    cards: list[CardBriefResponse]
    created_at: datetime

    model_config = {"from_attributes": True}
