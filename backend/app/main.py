from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, boards, cards, columns, labels

app = FastAPI(
    title="SyncBoard API",
    description="Real-time collaborative task board",
    version="0.1.0",
)

# CORS: allow the React frontend to call this API.
# In development, the frontend runs on localhost:5173 (Vite default).
# In production, this should be restricted to the actual frontend domain.
origins = ["http://localhost:5173", "http://localhost:3000"]
if settings.ENVIRONMENT == "production":
    # In production, set ALLOWED_ORIGINS env var to the Vercel domain
    origins = ["*"]  # TODO: restrict in Phase 5 deployment

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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


@app.get("/api/health")
async def health_check():
    """Health check endpoint for deployment platforms.

    Render, AWS ALBs, and Docker health checks all hit an endpoint
    to confirm the service is running. This returns 200 with no
    database call — it just confirms the FastAPI process is alive.
    """
    return {"status": "healthy", "service": "syncboard-api"}
