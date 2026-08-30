from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.realtime.pubsub import redis_service
from app.routers import activity, auth, boards, cards, columns, labels
from app.routers import websocket as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown of long-lived connections.

    asynccontextmanager replaces the older @app.on_event("startup")
    pattern. Everything before `yield` runs at startup, everything
    after runs at shutdown. This ensures Redis connections are
    properly cleaned up even if the server crashes.
    """
    # Startup: connect to Redis
    await redis_service.connect()
    yield
    # Shutdown: disconnect from Redis
    await redis_service.disconnect()


app = FastAPI(
    title="SyncBoard API",
    description="Real-time collaborative task board",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS: allow the React frontend to call this API.
# In development, the frontend runs on localhost:5173 (Vite default).
# In production, allow any Vercel deployment URL for this project.
# Note: allow_origins=["*"] with allow_credentials=True is invalid
# per the CORS spec — browsers reject it. Use allow_origin_regex instead.
origins = ["http://localhost:5173", "http://localhost:3000"]
origin_regex = None

if settings.ENVIRONMENT == "production":
    origins = []
    origin_regex = r"https://syncboard.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router)
app.include_router(boards.router)
app.include_router(columns.router)
app.include_router(cards.router)
app.include_router(labels.router)
app.include_router(activity.router)
app.include_router(ws_router.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint for deployment platforms.

    Render, AWS ALBs, and Docker health checks all hit an endpoint
    to confirm the service is running. This returns 200 with no
    database call — it just confirms the FastAPI process is alive.
    """
    return {"status": "healthy", "service": "syncboard-api"}