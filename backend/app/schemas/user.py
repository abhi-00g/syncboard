import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserRegister(BaseModel):
    """What a client sends to register.

    Password validation enforces security requirements at the API boundary.
    If the password is weak, Pydantic returns a 422 with a clear error
    message before the route handler even runs.
    """

    email: EmailStr
    password: str
    display_name: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Display name must be at least 2 characters long")
        if len(v) > 100:
            raise ValueError("Display name must be at most 100 characters long")
        return v


class UserLogin(BaseModel):
    """What a client sends to log in."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """What the API returns for user data.

    Notice password_hash is NOT here. Schemas control what
    leaves the API. Even if the ORM model has password_hash,
    this schema ensures it's never sent to the client.
    """

    id: int
    email: str
    display_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """What the API returns after successful login."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
