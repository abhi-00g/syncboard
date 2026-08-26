from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.user import UserRegister, UserLogin, TokenResponse
from app.services.auth import register_user, authenticate_user, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
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
        user=user,  # Pydantic filters out password_hash via UserResponse schema
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
