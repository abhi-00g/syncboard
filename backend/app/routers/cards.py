from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.realtime.events import (
    CARD_CREATED,
    CARD_DELETED,
    CARD_MOVED,
    CARD_UPDATED,
    COMMENT_ADDED,
    COMMENT_DELETED,
    LABEL_ATTACHED,
    LABEL_REMOVED,
    broadcast_event,
)
from app.schemas.card import (
    CardCreate,
    CardDetailResponse,
    CardMove,
    CardUpdate,
    CommentCreate,
    CommentResponse,
)
from app.schemas.column import CardBriefResponse
from app.services.activity import log_activity
from app.services.card import (
    ConflictError,
    add_comment,
    attach_label_to_card,
    create_card,
    delete_card,
    delete_comment,
    get_card_detail,
    move_card,
    remove_label_from_card,
    update_card,
    verify_board_access,
)

router = APIRouter(prefix="/api/boards/{board_id}/cards", tags=["cards"])


async def _check_membership(board_id: int, user: User, db: AsyncSession):
    try:
        await verify_board_access(db, board_id, user.id)
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this board",
        )


@router.post("/", response_model=CardBriefResponse, status_code=status.HTTP_201_CREATED)
async def create_new_card(
    board_id: int,
    body: CardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new card in a column."""
    await _check_membership(board_id, current_user, db)

    try:
        card = await create_card(
            db=db,
            board_id=board_id,
            column_id=body.column_id,
            title=body.title,
            description=body.description,
            created_by=current_user.id,
            assigned_to=body.assigned_to,
            due_date=body.due_date,
            position=body.position,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

    event_data = {
        "card_id": card.id,
        "column_id": card.column_id,
        "title": card.title,
        "position": card.position,
        "version": card.version,
    }

    await broadcast_event(board_id, CARD_CREATED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, CARD_CREATED, "card", card.id, event_data)

    return card


@router.get("/{card_id}", response_model=CardDetailResponse)
async def get_card(
    board_id: int,
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full card detail including comments, labels, and assignee."""
    await _check_membership(board_id, current_user, db)

    try:
        card = await get_card_detail(db, card_id, board_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )

    return card


@router.put("/{card_id}", response_model=CardBriefResponse)
async def update_existing_card(
    board_id: int,
    card_id: int,
    body: CardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a card's content with optimistic concurrency control."""
    await _check_membership(board_id, current_user, db)

    try:
        card = await update_card(
            db=db,
            card_id=card_id,
            board_id=board_id,
            version=body.version,
            title=body.title,
            description=body.description,
            assigned_to=body.assigned_to,
            due_date=body.due_date,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(e), "current_version": e.current_version},
        )

    event_data = {
        "card_id": card.id,
        "column_id": card.column_id,
        "title": card.title,
        "position": card.position,
        "version": card.version,
        "assigned_to": card.assigned_to,
        "due_date": card.due_date.isoformat() if card.due_date else None,
    }

    await broadcast_event(board_id, CARD_UPDATED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, CARD_UPDATED, "card", card.id, event_data)

    return card


@router.put("/{card_id}/move", response_model=CardBriefResponse)
async def move_existing_card(
    board_id: int,
    card_id: int,
    body: CardMove,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move a card to a different column and/or position."""
    await _check_membership(board_id, current_user, db)

    try:
        card = await move_card(
            db=db,
            card_id=card_id,
            board_id=board_id,
            target_column_id=body.column_id,
            target_position=body.position,
            version=body.version,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(e), "current_version": e.current_version},
        )

    event_data = {
        "card_id": card.id,
        "from_column_id": body.column_id,
        "to_column_id": card.column_id,
        "position": card.position,
        "version": card.version,
    }

    await broadcast_event(board_id, CARD_MOVED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, CARD_MOVED, "card", card.id, event_data)

    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_card(
    board_id: int,
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a card and all its comments and labels."""
    await _check_membership(board_id, current_user, db)

    try:
        await delete_card(db, card_id, board_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )

    event_data = {"card_id": card_id}

    await broadcast_event(board_id, CARD_DELETED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, CARD_DELETED, "card", card_id, event_data)


# ──────────────────────────────────────────────
# Comments
# ──────────────────────────────────────────────


@router.post(
    "/{card_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    board_id: int,
    card_id: int,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a comment to a card."""
    await _check_membership(board_id, current_user, db)

    try:
        comment = await add_comment(db, card_id, board_id, current_user.id, body.content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )

    event_data = {
        "comment_id": comment.id,
        "card_id": card_id,
        "user_id": current_user.id,
        "content": comment.content,
        "created_at": comment.created_at.isoformat(),
    }

    await broadcast_event(board_id, COMMENT_ADDED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, COMMENT_ADDED, "comment", comment.id, event_data)

    return comment


@router.delete(
    "/{card_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_comment(
    board_id: int,
    card_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a comment. Only the comment author can do this."""
    await _check_membership(board_id, current_user, db)

    try:
        await delete_comment(db, comment_id, card_id, board_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(e)
        )

    event_data = {"comment_id": comment_id, "card_id": card_id}

    await broadcast_event(board_id, COMMENT_DELETED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, COMMENT_DELETED, "comment", comment_id, event_data)


# ──────────────────────────────────────────────
# Card-Label operations
# ──────────────────────────────────────────────


@router.post(
    "/{card_id}/labels/{label_id}",
    status_code=status.HTTP_201_CREATED,
)
async def attach_label(
    board_id: int,
    card_id: int,
    label_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attach a label to a card."""
    await _check_membership(board_id, current_user, db)

    try:
        await attach_label_to_card(db, card_id, label_id, board_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

    event_data = {"card_id": card_id, "label_id": label_id}

    await broadcast_event(board_id, LABEL_ATTACHED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, LABEL_ATTACHED, "card", card_id, event_data)

    return {"detail": "Label attached"}


@router.delete(
    "/{card_id}/labels/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def detach_label(
    board_id: int,
    card_id: int,
    label_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a label from a card."""
    await _check_membership(board_id, current_user, db)

    try:
        await remove_label_from_card(db, card_id, label_id, board_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )

    event_data = {"card_id": card_id, "label_id": label_id}

    await broadcast_event(board_id, LABEL_REMOVED, event_data, current_user.id)
    await log_activity(db, board_id, current_user.id, LABEL_REMOVED, "card", card_id, event_data)
