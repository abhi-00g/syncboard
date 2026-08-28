import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.board import Board, BoardMember
from app.models.card import Card
from app.models.column import Column
from app.schemas.user import UserRegister, UserLogin, TokenResponse, UserResponse
from app.services.auth import register_user, authenticate_user, create_access_token
from app.services.board import create_board

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GuestTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    board_id: int


# Keys MUST match DEFAULT_COLUMNS in services/board.py:
# ["Backlog", "To Do", "In Progress", "In Review", "Done"]

DEMO_CARDS: dict[str, list[tuple[str, str]]] = {
    "Backlog": [
        ("Add CSV export", "Allow users to export board data as a CSV file"),
        ("Set up monitoring", "Configure health checks and error alerting for production"),
    ],
    "To Do": [
        ("Write API documentation", "Document all REST endpoints with request/response examples"),
        ("Add board search", "Let users search across cards by title and description"),
    ],
    "In Progress": [
        ("Implement drag-and-drop", "Card reordering between columns with optimistic updates"),
        ("WebSocket reconnection", "Auto-reconnect with exponential backoff on disconnect"),
    ],
    "In Review": [
        ("User authentication", "JWT-based auth with login, register, and password validation"),
    ],
    "Done": [
        ("Design database schema", "PostgreSQL schema for users, boards, columns, and cards"),
        ("Set up Docker Compose", "Local dev environment with FastAPI, PostgreSQL, and Redis"),
        ("Real-time presence", "Show which users are currently viewing the board"),
    ],
}

# Marker name used to identify the shared demo board.
DEMO_BOARD_NAME = "SyncBoard Demo"


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """Create a new account and return a JWT token.

    We return a token immediately after registration so the user
    doesn't have to log in separately. One step: register → logged in.
    """
    try:
        user = await register_user(db, body.email, body.password, body.display_name)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and return a JWT token.

    Accepts OAuth2 form data (username + password). The 'username'
    field contains the user's email — this is the OAuth2 standard,
    where the field is always called 'username' regardless of what
    the actual identifier is.

    Returns the same 401 for both "email not found" and "wrong password"
    to prevent email enumeration attacks.
    """
    user = await authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=user)


@router.post(
    "/guest", response_model=GuestTokenResponse, status_code=status.HTTP_201_CREATED
)
async def guest_login(db: AsyncSession = Depends(get_db)):
    """Create a temporary guest account and put them on the shared demo board.

    Every "Try Demo" click creates a new guest user but they all join the
    SAME demo board. This means two browser tabs, or a regular window and
    an incognito window, will see each other's real-time changes — which is
    the whole point of the demo.

    On the first ever guest login the demo board is created and seeded with
    sample cards. Subsequent guests are added as members of that board.
    """
    # 1. Create guest user
    guest_id = str(uuid.uuid4()).replace("-", "")[:8]
    email = f"guest-{guest_id}@syncboard.demo"
    password = f"Gx{guest_id}!1"  # Satisfies: upper, lower, digit, special
    display_name = f"Guest {guest_id[:4].upper()}"

    try:
        user = await register_user(db, email, password, display_name)
    except ValueError:
        guest_id = str(uuid.uuid4()).replace("-", "")[:8]
        email = f"guest-{guest_id}@syncboard.demo"
        password = f"Gx{guest_id}!1"
        display_name = f"Guest {guest_id[:4].upper()}"
        user = await register_user(db, email, password, display_name)

    token = create_access_token(user.id)

    # 2. Look for an existing shared demo board
    result = await db.execute(
        select(Board).where(Board.name == DEMO_BOARD_NAME).limit(1)
    )
    demo_board = result.scalar_one_or_none()

    if demo_board:
        # Board already exists — add guest as a member
        membership = BoardMember(
            board_id=demo_board.id,
            user_id=user.id,
            role="member",
        )
        db.add(membership)
        await db.commit()
        board_id = demo_board.id
    else:
        # First guest ever — create the board and seed it
        board = await create_board(db, DEMO_BOARD_NAME, user)

        # Query the columns that create_board just made
        col_result = await db.execute(
            select(Column)
            .where(Column.board_id == board.id)
            .order_by(Column.position)
        )
        columns = col_result.scalars().all()
        column_map = {col.name: col for col in columns}

        # Seed demo cards
        for col_name, cards_data in DEMO_CARDS.items():
            col = column_map.get(col_name)
            if col is None:
                continue
            for position, (card_title, description) in enumerate(cards_data):
                card = Card(
                    column_id=col.id,
                    title=card_title,
                    description=description,
                    position=position,
                    created_by=user.id,
                    version=1,
                )
                db.add(card)

        await db.commit()
        board_id = board.id

    return GuestTokenResponse(
        access_token=token,
        user=user,
        board_id=board_id,
    )
