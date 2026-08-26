from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.activity import ActivityEventResponse
from app.services.board import check_board_membership
from app.services.activity import get_board_activity

router = APIRouter(prefix="/api/boards/{board_id}/activity", tags=["activity"])


@router.get("/", response_model=list[ActivityEventResponse])
async def list_activity(
    board_id: int,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent activity for a board.

    Returns the most recent events first. The frontend uses this
    to populate the activity sidebar when a board is opened, and
    to load more history as the user scrolls.
    """
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    return await get_board_activity(db, board_id, limit, offset)
