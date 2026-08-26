from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

from app.config import settings
from app.database import async_session
from app.models.user import User

# OAuth2PasswordBearer tells FastAPI to look for a Bearer token
# in the Authorization header. tokenUrl is where clients POST
# credentials to get a token — it's used by Swagger docs to
# show a login form, not by your actual frontend.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session, then close it.

    FastAPI's dependency injection calls this for every request
    that needs a database connection. The `async with` ensures
    the session is always closed, even if the request handler
    throws an exception. This prevents connection leaks.
    """
    async with async_session() as session:
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode JWT token and return the authenticated user.

    This dependency chain works like this:
    1. FastAPI extracts the Bearer token from the Authorization header
    2. We decode and verify the JWT signature
    3. We look up the user in the database
    4. The route handler receives a User object

    If any step fails, the request gets a 401 before reaching
    your route handler. You never write auth-checking code in routes.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: int | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user
