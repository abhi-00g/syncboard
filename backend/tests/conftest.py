"""
Test fixtures for the SyncBoard backend.

Uses an in-memory SQLite database via aiosqlite + StaticPool so all
connections share the same database. Redis is mocked via patch.object
on the singleton redis_service — this makes broadcast_event, lifespan
connect/disconnect, and presence calls all no-ops without needing to
patch every router import individually.
"""

import os

# Set BEFORE any app module is imported — Settings reads env at import time
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
os.environ["ENVIRONMENT"] = "testing"

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.realtime.pubsub import redis_service

# ── Test database engine ──
# StaticPool ensures all connections share one in-memory SQLite database.
# Without it, each connection gets its own empty database.

test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enable foreign key enforcement in SQLite (off by default)
@event.listens_for(test_engine.sync_engine, "connect")
def _enable_fk(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSession = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def _override_get_db():
    async with TestSession() as session:
        yield session


# Override the get_db dependency so all routes use the test database
app.dependency_overrides[get_db] = _override_get_db


# ── Fixtures ──


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
def mock_redis():
    """Mock every method on the Redis service singleton.

    patch.object modifies the actual object, so all modules that
    imported redis_service see the mock — no need to patch each
    router's import separately.
    """
    methods = [
        "connect", "disconnect", "publish", "subscribe_board",
        "unsubscribe_board", "set_presence", "remove_presence",
        "get_present_users", "refresh_presence",
    ]
    patches = []
    for method in methods:
        if hasattr(redis_service, method):
            p = patch.object(redis_service, method, new_callable=AsyncMock)
            p.start()
            patches.append(p)
    # get_present_users should return an empty list, not None
    if hasattr(redis_service, "get_present_users"):
        redis_service.get_present_users.return_value = []
    yield
    for p in patches:
        p.stop()


@pytest_asyncio.fixture
async def client():
    """Async HTTP client wired to the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def authed(client: AsyncClient):
    """Register a test user and return (auth_headers, user_dict)."""
    resp = await client.post("/api/auth/register", json={
        "email": "alice@test.com",
        "password": "StrongPass1!",
        "display_name": "Alice",
    })
    assert resp.status_code == 201
    data = resp.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return headers, data["user"]


@pytest_asyncio.fixture
async def board_setup(client: AsyncClient, authed):
    """Create a board owned by the authed user. Returns (headers, board_detail)."""
    headers, user = authed
    resp = await client.post(
        "/api/boards/", json={"name": "Sprint 1"}, headers=headers
    )
    assert resp.status_code == 201
    # Fetch full detail to get columns
    board_id = resp.json()["id"]
    detail = await client.get(f"/api/boards/{board_id}", headers=headers)
    return headers, detail.json()
