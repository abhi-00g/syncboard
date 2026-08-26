from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.realtime.events import LABEL_CREATED, LABEL_DELETED, broadcast_event
from app.schemas.card import LabelCreate, LabelResponse
from app.services.card import (
    create_label,
    delete_label,
    get_board_labels,
    verify_board_access,
)

router = APIRouter(prefix="/api/boards/{board_id}/labels", tags=["labels"])


@router.post("/", response_model=LabelResponse, status_code=status.HTTP_201_CREATED)
async def create_new_label(
    board_id: int,
    body: LabelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new label for this board."""
    try:
        await verify_board_access(db, board_id, current_user.id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    label = await create_label(db, board_id, body.name, body.color)

    await broadcast_event(
        board_id=board_id,
        event_type=LABEL_CREATED,
        data={
            "label_id": label.id,
            "name": label.name,
            "color": label.color,
        },
        actor_id=current_user.id,
    )

    return label


@router.get("/", response_model=list[LabelResponse])
async def list_labels(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all labels defined for this board."""
    try:
        await verify_board_access(db, board_id, current_user.id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    return await get_board_labels(db, board_id)


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_label(
    board_id: int,
    label_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a label from the board. Removes it from all cards too."""
    try:
        await verify_board_access(db, board_id, current_user.id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    try:
        await delete_label(db, label_id, board_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )

    await broadcast_event(
        board_id=board_id,
        event_type=LABEL_DELETED,
        data={"label_id": label_id},
        actor_id=current_user.id,
    )
