from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.card import Card
from app.models.column import Column
from app.models.comment import Comment
from app.models.label import CardLabel, Label
from app.services.board import check_board_membership


async def verify_board_access(db: AsyncSession, board_id: int, user_id: int):
    """Check board membership and raise ValueError if denied.

    This is called at the start of every card/comment/label operation.
    Centralizing it here avoids repeating the same check in every route.
    """
    membership = await check_board_membership(db, board_id, user_id)
    if membership is None:
        raise PermissionError("You are not a member of this board")


async def verify_card_belongs_to_board(
    db: AsyncSession, card_id: int, board_id: int
) -> Card:
    """Load a card and verify it belongs to the given board.

    Cards belong to columns, columns belong to boards. We join
    through Column to verify the chain without a direct board_id
    on the card. Returns the card if valid, raises if not found
    or wrong board.
    """
    result = await db.execute(
        select(Card)
        .join(Column, Card.column_id == Column.id)
        .where(Card.id == card_id, Column.board_id == board_id)
    )
    card = result.scalar_one_or_none()
    if card is None:
        raise ValueError("Card not found in this board")
    return card


async def get_next_card_position(db: AsyncSession, column_id: int) -> int:
    """Get the next available position for a new card in a column."""
    result = await db.execute(
        select(func.coalesce(func.max(Card.position), -1)).where(
            Card.column_id == column_id
        )
    )
    return result.scalar() + 1


async def verify_column_belongs_to_board(
    db: AsyncSession, column_id: int, board_id: int
) -> Column:
    """Load a column and verify it belongs to the given board."""
    result = await db.execute(
        select(Column).where(Column.id == column_id, Column.board_id == board_id)
    )
    column = result.scalar_one_or_none()
    if column is None:
        raise ValueError("Column not found in this board")
    return column


# ──────────────────────────────────────────────
# Card CRUD
# ──────────────────────────────────────────────


async def create_card(
    db: AsyncSession,
    board_id: int,
    column_id: int,
    title: str,
    created_by: int,
    description: str | None = None,
    assigned_to: int | None = None,
    due_date=None,
    position: int | None = None,
) -> Card:
    """Create a new card in a column.

    Validates that the column belongs to the board before creating.
    If position is not provided, the card is added at the end.
    """
    await verify_column_belongs_to_board(db, column_id, board_id)

    if position is None:
        position = await get_next_card_position(db, column_id)

    card = Card(
        column_id=column_id,
        title=title,
        description=description,
        position=position,
        created_by=created_by,
        assigned_to=assigned_to,
        due_date=due_date,
    )
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return card


async def get_card_detail(db: AsyncSession, card_id: int, board_id: int) -> Card:
    """Load a card with all its relationships for the detail view.

    Eagerly loads: creator, assignee, labels (with label details),
    and comments (with user details). This is what the frontend
    shows when a user clicks on a card.
    """
    result = await db.execute(
        select(Card)
        .join(Column, Card.column_id == Column.id)
        .where(Card.id == card_id, Column.board_id == board_id)
        .options(
            selectinload(Card.creator),
            selectinload(Card.assignee),
            selectinload(Card.labels).selectinload(CardLabel.label),
            selectinload(Card.comments).selectinload(Comment.user),
        )
    )
    card = result.scalar_one_or_none()
    if card is None:
        raise ValueError("Card not found in this board")
    return card


async def update_card(
    db: AsyncSession,
    card_id: int,
    board_id: int,
    version: int,
    title: str | None = None,
    description: str | None = None,
    assigned_to: int | None = None,
    due_date=None,
    clear_due_date: bool = False,
    clear_assignee: bool = False,
) -> Card:
    """Update a card's content with optimistic concurrency control.

    The version check is the core of conflict detection:
    1. Client sends version=7 (the version they see on screen)
    2. Server checks: is the card's current version 7?
    3. If yes → apply update, increment to version 8
    4. If no → someone else edited it first, reject with 409

    This prevents lost updates without using database locks.
    No row-level lock means other reads aren't blocked.
    """
    card = await verify_card_belongs_to_board(db, card_id, board_id)

    if card.version != version:
        raise ConflictError(
            f"Version conflict: expected {version}, current is {card.version}",
            current_version=card.version,
        )

    if title is not None:
        card.title = title
    if description is not None:
        card.description = description
    if assigned_to is not None:
        card.assigned_to = assigned_to
    if clear_assignee:
        card.assigned_to = None
    if due_date is not None:
        card.due_date = due_date
    if clear_due_date:
        card.due_date = None

    card.version += 1
    await db.commit()
    await db.refresh(card)
    return card


async def move_card(
    db: AsyncSession,
    card_id: int,
    board_id: int,
    target_column_id: int,
    target_position: int,
    version: int,
) -> Card:
    """Move a card to a different column and/or position.

    Same version check as update_card. Moving is a separate
    operation because it changes the card's location (column +
    position), not its content. In Phase 3, these become
    different WebSocket event types.
    """
    card = await verify_card_belongs_to_board(db, card_id, board_id)

    if card.version != version:
        raise ConflictError(
            f"Version conflict: expected {version}, current is {card.version}",
            current_version=card.version,
        )

    # Verify target column belongs to the same board
    await verify_column_belongs_to_board(db, target_column_id, board_id)

    card.column_id = target_column_id
    card.position = target_position
    card.version += 1
    await db.commit()
    await db.refresh(card)
    return card


async def delete_card(db: AsyncSession, card_id: int, board_id: int) -> None:
    """Delete a card and all its comments and label associations.

    cascade='all, delete-orphan' on the Card model handles
    cleaning up comments and card_labels automatically.
    """
    card = await verify_card_belongs_to_board(db, card_id, board_id)
    await db.delete(card)
    await db.commit()


# ──────────────────────────────────────────────
# Comments
# ──────────────────────────────────────────────


async def add_comment(
    db: AsyncSession, card_id: int, board_id: int, user_id: int, content: str
) -> Comment:
    """Add a comment to a card."""
    await verify_card_belongs_to_board(db, card_id, board_id)

    comment = Comment(card_id=card_id, user_id=user_id, content=content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    # Load the user relationship for the response
    result = await db.execute(
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.user))
    )
    return result.scalar_one()


async def delete_comment(
    db: AsyncSession, comment_id: int, card_id: int, board_id: int, user_id: int
) -> None:
    """Delete a comment. Only the comment author can delete it."""
    await verify_card_belongs_to_board(db, card_id, board_id)

    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.card_id == card_id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise ValueError("Comment not found")
    if comment.user_id != user_id:
        raise PermissionError("You can only delete your own comments")

    await db.delete(comment)
    await db.commit()


# ──────────────────────────────────────────────
# Labels
# ──────────────────────────────────────────────


async def create_label(
    db: AsyncSession, board_id: int, name: str, color: str
) -> Label:
    """Create a label at the board level."""
    label = Label(board_id=board_id, name=name, color=color)
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return label


async def get_board_labels(db: AsyncSession, board_id: int) -> list[Label]:
    """Get all labels defined for a board."""
    result = await db.execute(
        select(Label).where(Label.board_id == board_id).order_by(Label.name)
    )
    return list(result.scalars().all())


async def delete_label(db: AsyncSession, label_id: int, board_id: int) -> None:
    """Delete a label. Also removes it from all cards (via cascade)."""
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.board_id == board_id)
    )
    label = result.scalar_one_or_none()
    if label is None:
        raise ValueError("Label not found in this board")
    await db.delete(label)
    await db.commit()


async def attach_label_to_card(
    db: AsyncSession, card_id: int, label_id: int, board_id: int
) -> None:
    """Attach a label to a card. Both must belong to the same board."""
    await verify_card_belongs_to_board(db, card_id, board_id)

    # Verify label belongs to same board
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.board_id == board_id)
    )
    if result.scalar_one_or_none() is None:
        raise ValueError("Label not found in this board")

    # Check if already attached
    result = await db.execute(
        select(CardLabel).where(
            CardLabel.card_id == card_id, CardLabel.label_id == label_id
        )
    )
    if result.scalar_one_or_none() is not None:
        raise ValueError("Label already attached to this card")

    card_label = CardLabel(card_id=card_id, label_id=label_id)
    db.add(card_label)
    await db.commit()


async def remove_label_from_card(
    db: AsyncSession, card_id: int, label_id: int, board_id: int
) -> None:
    """Remove a label from a card."""
    await verify_card_belongs_to_board(db, card_id, board_id)

    result = await db.execute(
        select(CardLabel).where(
            CardLabel.card_id == card_id, CardLabel.label_id == label_id
        )
    )
    card_label = result.scalar_one_or_none()
    if card_label is None:
        raise ValueError("Label not attached to this card")

    await db.delete(card_label)
    await db.commit()


# ──────────────────────────────────────────────
# Custom exception for version conflicts
# ──────────────────────────────────────────────


class ConflictError(Exception):
    """Raised when optimistic concurrency check fails.

    Carries the current version so the API can return it
    to the client, who can then refresh their state.
    """

    def __init__(self, message: str, current_version: int):
        super().__init__(message)
        self.current_version = current_version
