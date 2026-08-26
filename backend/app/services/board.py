from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.board import Board, BoardMember
from app.models.column import Column
from app.models.user import User


# Default columns created with every new board.
# These mirror the standard Kanban workflow.
DEFAULT_COLUMNS = ["Backlog", "To Do", "In Progress", "In Review", "Done"]


async def create_board(db: AsyncSession, name: str, owner: User) -> Board:
    """Create a board with default columns and add the owner as a member.

    Three things happen in one transaction:
    1. Create the board
    2. Add the owner as a board member with role "owner"
    3. Create default columns with sequential positions

    If any step fails, the entire transaction rolls back.
    """
    board = Board(name=name, owner_id=owner.id)
    db.add(board)
    await db.flush()  # Assigns board.id without committing

    # Add owner as a member
    membership = BoardMember(
        board_id=board.id,
        user_id=owner.id,
        role="owner",
    )
    db.add(membership)

    # Create default columns
    for i, col_name in enumerate(DEFAULT_COLUMNS):
        column = Column(board_id=board.id, name=col_name, position=i)
        db.add(column)

    await db.commit()
    await db.refresh(board)
    return board


async def get_user_boards(db: AsyncSession, user: User) -> list[Board]:
    """Get all boards the user is a member of (including owned boards)."""
    result = await db.execute(
        select(Board)
        .join(BoardMember, Board.id == BoardMember.board_id)
        .where(BoardMember.user_id == user.id)
        .order_by(Board.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_board_detail(db: AsyncSession, board_id: int) -> Board | None:
    """Load a board with all its columns, cards, and members.

    selectinload tells SQLAlchemy to load relationships eagerly
    in separate SELECT queries (not lazy-loaded). Without this,
    accessing board.columns would trigger a lazy load, which
    fails in async context.

    The nested selectinload (columns -> cards) loads two levels
    deep in a single call: board -> columns -> cards.
    """
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id)
        .options(
            selectinload(Board.columns).selectinload(Column.cards),
            selectinload(Board.members).selectinload(BoardMember.user),
        )
    )
    return result.scalar_one_or_none()


async def check_board_membership(
    db: AsyncSession, board_id: int, user_id: int
) -> BoardMember | None:
    """Check if a user is a member of a board. Returns the membership or None.

    This is the authorization check used by every board-scoped endpoint.
    """
    result = await db.execute(
        select(BoardMember).where(
            BoardMember.board_id == board_id,
            BoardMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def add_board_member(
    db: AsyncSession, board_id: int, email: str
) -> BoardMember:
    """Add a user to a board by their email address."""
    # Find the user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")

    # Check if already a member
    existing = await check_board_membership(db, board_id, user.id)
    if existing is not None:
        raise ValueError("User is already a board member")

    membership = BoardMember(
        board_id=board_id,
        user_id=user.id,
        role="member",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


async def get_next_column_position(db: AsyncSession, board_id: int) -> int:
    """Get the next available position for a new column on a board."""
    result = await db.execute(
        select(func.coalesce(func.max(Column.position), -1)).where(
            Column.board_id == board_id
        )
    )
    max_position = result.scalar()
    return max_position + 1
