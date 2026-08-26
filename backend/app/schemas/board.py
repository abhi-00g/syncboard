from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserResponse


class BoardCreate(BaseModel):
    name: str


class BoardUpdate(BaseModel):
    name: str


class BoardMemberResponse(BaseModel):
    id: int
    user: UserResponse
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class BoardResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BoardDetailResponse(BaseModel):
    """Full board with columns, cards, and members.

    This is what the frontend loads when opening a board.
    One API call returns everything needed to render the
    full board state — no waterfall of requests.
    """

    id: int
    name: str
    owner_id: int
    columns: list["ColumnWithCardsResponse"]
    members: list[BoardMemberResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    email: str


# Forward reference - will be defined in column schemas
from app.schemas.column import ColumnWithCardsResponse  # noqa: E402

BoardDetailResponse.model_rebuild()
