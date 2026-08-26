from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    """What a client sends to register."""

    email: EmailStr
    password: str
    display_name: str


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
