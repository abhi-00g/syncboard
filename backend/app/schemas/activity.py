from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserResponse


class ActivityEventResponse(BaseModel):
    id: int
    board_id: int
    user: UserResponse
    event_type: str
    entity_type: str
    entity_id: int
    detail: str  # JSON string — frontend parses it
    created_at: datetime

    model_config = {"from_attributes": True}
