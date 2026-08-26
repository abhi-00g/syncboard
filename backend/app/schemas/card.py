from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserResponse


class CardCreate(BaseModel):
    column_id: int  # Which column to create the card in
    title: str
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[datetime] = None
    position: Optional[int] = None  # Auto-assigned if not provided


class CardUpdate(BaseModel):
    """Update a card's content.

    `version` is required — this is the optimistic concurrency control.
    The client must send the version they're editing. If it doesn't
    match the server's version, the update is rejected (409 Conflict).
    """

    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[datetime] = None
    version: int  # Required for concurrency control


class CardMove(BaseModel):
    """Move a card to a different column and/or position."""

    column_id: int
    position: int
    version: int  # Required for concurrency control


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    card_id: int
    user: UserResponse
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LabelCreate(BaseModel):
    name: str
    color: str


class LabelResponse(BaseModel):
    id: int
    board_id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class CardLabelResponse(BaseModel):
    """Label data as attached to a card, via the junction table."""

    id: int  # CardLabel id
    label: LabelResponse

    model_config = {"from_attributes": True}


class CardDetailResponse(BaseModel):
    """Full card detail — shown when user clicks on a card."""

    id: int
    column_id: int
    title: str
    description: Optional[str]
    position: int
    version: int
    created_by: int
    assigned_to: Optional[int]
    due_date: Optional[datetime]
    creator: UserResponse
    assignee: Optional[UserResponse]
    labels: list[CardLabelResponse]
    comments: list[CommentResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
