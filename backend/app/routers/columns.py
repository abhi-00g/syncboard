from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.column import Column
from app.models.user import User
from app.schemas.column import ColumnCreate, ColumnResponse, ColumnUpdate
from app.services.board import check_board_membership, get_next_column_position

router = APIRouter(prefix="/api/boards/{board_id}/columns", tags=["columns"])


@router.post("/", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(
    board_id: int,
    body: ColumnCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new column to a board.

    If position is not provided, the column is added at the end.
    """
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    position = body.position
    if position is None:
        position = await get_next_column_position(db, board_id)

    column = Column(board_id=board_id, name=body.name, position=position)
    db.add(column)
    await db.commit()
    await db.refresh(column)
    return column


@router.put("/{column_id}", response_model=ColumnResponse)
async def update_column(
    board_id: int,
    column_id: int,
    body: ColumnUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a column's name or position."""
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    result = await db.execute(
        select(Column).where(Column.id == column_id, Column.board_id == board_id)
    )
    column = result.scalar_one_or_none()
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if body.name is not None:
        column.name = body.name
    if body.position is not None:
        column.position = body.position

    await db.commit()
    await db.refresh(column)
    return column


@router.delete("/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    board_id: int,
    column_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a column and all its cards."""
    membership = await check_board_membership(db, board_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    result = await db.execute(
        select(Column).where(Column.id == column_id, Column.board_id == board_id)
    )
    column = result.scalar_one_or_none()
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.delete(column)
    await db.commit()
