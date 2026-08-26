from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Pydantic Settings reads env vars automatically and validates types.
    If DATABASE_URL is missing at startup, the app crashes immediately
    with a clear error instead of failing on the first database call.
    """

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ENVIRONMENT: str = "development"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
