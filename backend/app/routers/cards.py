from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.card import (
    CardCreate,
    CardDetailResponse,
    CardMove,
    CardUpdate,
    CommentCreate,
    CommentResponse,
)
from app.schemas.column import CardBriefResponse
from app.services.board import check_board_membership
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
    """Shared authorization check for all card routes."""
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
    """Create a new card in a column.

    The column_id is in the request body because a card belongs
    to a specific column, but the URL is scoped to the board
    (for authorization). The column must belong to this board.
    """
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

    return card


@router.get("/{card_id}", response_model=CardDetailResponse)
async def get_card(
    board_id: int,
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full card detail including comments, labels, and assignee.

    This is called when a user clicks on a card to open the detail modal.
    """
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
    """Update a card's content (title, description, assignee, due date).

    Requires the current version number for optimistic concurrency control.
    If the version doesn't match (someone else edited it), returns 409.
    """
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
            detail={
                "message": str(e),
                "current_version": e.current_version,
            },
        )

    return card


@router.put("/{card_id}/move", response_model=CardBriefResponse)
async def move_existing_card(
    board_id: int,
    card_id: int,
    body: CardMove,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move a card to a different column and/or position.

    Separate from update because moving changes location,
    not content. These become different WebSocket events in Phase 3.
    Returns 409 if the version doesn't match.
    """
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
            detail={
                "message": str(e),
                "current_version": e.current_version,
            },
        )

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


# ──────────────────────────────────────────────
# Comments (nested under cards)
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
    """Add a comment to a card.

    In Phase 3, this will also broadcast a real-time event
    so other users viewing the card see the comment appear.
    """
    await _check_membership(board_id, current_user, db)

    try:
        comment = await add_comment(db, card_id, board_id, current_user.id, body.content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )

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


# ──────────────────────────────────────────────
# Card-Label operations (attach / remove)
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
    """Attach a label to a card. Both must belong to the same board."""
    await _check_membership(board_id, current_user, db)

    try:
        await attach_label_to_card(db, card_id, label_id, board_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

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
