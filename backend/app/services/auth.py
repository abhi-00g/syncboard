from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User

# CryptContext handles hashing and verification.
# "bcrypt" is the scheme — it's slow by design (configurable rounds),
# making brute-force attacks impractical even if the database leaks.
# deprecated="auto" means if we add a new scheme later, old hashes
# are still verifiable but new passwords use the new scheme.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int) -> str:
    """Create a JWT token with the user's ID as the subject.

    The token contains:
    - sub (subject): the user's ID — this is how we know who the token belongs to
    - exp (expiration): when the token becomes invalid
    - iat (issued at): when the token was created

    The token is signed with JWT_SECRET_KEY using HMAC-SHA256. Anyone can
    decode the payload (it's just base64), but only our server can verify
    the signature. This means: don't put sensitive data in the token.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": now,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    display_name: str,
) -> User:
    """Create a new user account.

    We check for existing email first. If we relied only on the
    database unique constraint, we'd get an IntegrityError with
    a Postgres-specific error message — harder to turn into a
    clean 409 response.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        raise ValueError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Verify credentials and return the user, or None if invalid.

    Important security detail: we return None for both "email not found"
    and "wrong password". If we returned different errors, an attacker
    could enumerate valid emails by checking the error message.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user
