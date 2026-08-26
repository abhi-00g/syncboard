from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# The engine manages a pool of database connections.
# pool_size=5 means 5 connections stay open and ready.
# max_overflow=10 means up to 10 extra connections can be created under load.
# When all 15 are in use, the next request waits instead of crashing.
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    echo=settings.ENVIRONMENT == "development",  # Log SQL queries in dev
)

# Session factory - creates new database sessions.
# expire_on_commit=False: after committing, objects stay usable without
# re-querying. Important for returning data in API responses after saving.
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models.

    Every model inherits from this. Alembic uses it to detect
    schema changes by comparing models against the database.
    """

    pass
