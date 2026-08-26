from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.board import (
    AddMemberRequest,
    BoardCreate,
    BoardDetailResponse,
    BoardMemberResponse,
    BoardResponse,
    BoardUpdate,
)
from app.services.board import (
    add_board_member,
    check_board_membership,
    create_board,
    get_board_detail,
    get_user_boards,
)

router = APIRouter(prefix="/api/boards", tags=["boards"])


@router.post("/", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
async def create_new_board(
    body: BoardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new board with default columns.

    The authenticated user becomes the board owner automatically.
    """
    board = await create_board(db, body.name, current_user)
    return board


@router.get("/", response_model=list[BoardResponse])
async def list_boards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all boards the current user is a member of."""
    return await get_user_boards(db, current_user)


@router.get("/{board_id}", response_model=BoardDetailResponse)
async def get_board(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full board detail with columns, cards, and members.

    Authorization check: the user must be a board member.
    This is the main endpoint the frontend calls when opening a board.
    """
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this board",
        )

    board = await get_board_detail(db, board_id)
    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    return board


@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: int,
    body: BoardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update board name. Only the owner can do this."""
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None or membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the board owner can update the board",
        )

    board = await get_board_detail(db, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    board.name = body.name
    await db.commit()
    await db.refresh(board)
    return board


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a board. Only the owner can do this.

    cascade='all, delete-orphan' on the Board model means deleting
    a board automatically deletes its columns, cards, memberships,
    etc. One delete, everything cleans up.
    """
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None or membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the board owner can delete the board",
        )

    board = await get_board_detail(db, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.delete(board)
    await db.commit()


@router.post(
    "/{board_id}/members",
    response_model=BoardMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    board_id: int,
    body: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a member to a board by email. Only the owner can do this."""
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None or membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the board owner can add members",
        )

    try:
        new_membership = await add_board_member(db, board_id, body.email)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Reload with user relationship for response
    await db.refresh(new_membership, ["user"])
    return new_membership
