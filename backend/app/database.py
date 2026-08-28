from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Build engine kwargs based on the database driver.
# PostgreSQL (asyncpg) supports pool_size and max_overflow.
# SQLite (aiosqlite) uses StaticPool for in-memory test databases
# and doesn't accept those arguments.

_engine_kwargs: dict = {
    "echo": settings.ENVIRONMENT == "development",
}

if settings.DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.pool import StaticPool

    _engine_kwargs["poolclass"] = StaticPool
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 10

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

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
