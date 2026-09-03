# SyncBoard

Real-time collaborative Kanban board with WebSocket synchronization, Redis pub/sub, and optimistic concurrency control.

**[Live Demo](https://syncboard-roan.vercel.app)** · **[Backend API](https://syncboard-backend-tffu.onrender.com/api/health)**

> ⏳ The demo runs on Render and Neon free tiers. The first load takes 30–60 seconds while both services wake from sleep. After that, everything is instant.

Click **"Try Demo"** on the landing page — it creates a guest account and a pre-seeded board with no signup required. Open it in two browser windows to see real-time sync in action.

## What makes this different

Most portfolio Kanban boards are CRUD apps with drag-and-drop. SyncBoard is built around the problems that make real-time collaboration hard:

- **WebSocket event broadcasting** — every card move, edit, and comment is pushed to all connected clients instantly. No polling, no stale state.
- **Redis pub/sub for horizontal scaling** — events are published to Redis channels, not sent directly between WebSocket connections. This means multiple backend instances can broadcast to each other's clients.
- **Optimistic concurrency control** — every card has a version number. When two users edit the same card, the second save is rejected with a 409 Conflict instead of silently overwriting the first.
- **Presence system** — Redis SETEX with 30-second TTL tracks who's viewing each board. A 15-second heartbeat keeps the TTL alive. When a user disconnects or their heartbeat stops, they disappear from the presence list.
- **Shared guest demo** — all "Try Demo" clicks join the same board, so you can see another person's changes in real time without creating accounts.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React Frontend (Vercel)                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Board    │ │ Card     │ │ Activity │ │ WebSocket Client  │   │
│  │ View     │ │ Detail   │ │ Sidebar  │ │ (auto-reconnect)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘   │
└────────────────────────┬────────────────────────┬───────────────┘
                    REST API                 WebSocket
                         │                        │
┌────────────────────────▼────────────────────────▼───────────────┐
│  FastAPI Backend (Render)                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────-┐  │
│  │ Auth     │ │ Board/   │ │ Activity │ │ WS Handler         │  │
│  │ (JWT)    │ │ Card API │ │ Log      │ │ (presence + events)│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────-┘  │
│                      │                          │               │
│               ┌──────▼──────┐          ┌────────▼───────-─┐     │
│               │ PostgreSQL  │          │ Redis Pub/Sub    │     │
│               │ (Neon)      │          │ (Upstash)        │     │
│               │ 9 tables    │          │ Presence + Events│     │
│               └─────────────┘          └─────────────────-┘     │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow for a card move:**
1. User drags card → optimistic update shows it instantly
2. Frontend sends `PUT /api/boards/{id}/cards/{id}/move` with the card's current version number
3. Backend verifies version matches (concurrency check), updates PostgreSQL, logs activity
4. Backend publishes `card_moved` event to Redis channel
5. Redis fan-out delivers the event to all WebSocket connections on that board
6. Other users' frontends receive the event and update their board state

## Tech stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React, TypeScript, Tailwind, Framer Motion | Type-safe components with smooth animations |
| Drag-and-drop | dnd-kit | Lightweight, accessible, works with React state |
| Backend | FastAPI, async SQLAlchemy, asyncpg | Async-native for WebSocket + HTTP on one server |
| Database | PostgreSQL (Neon) | Relational integrity for boards → columns → cards |
| Real-time | WebSockets, Redis pub/sub (Upstash) | Event broadcasting that scales across instances |
| Auth | JWT with Pydantic field validators | Stateless auth with strong password rules at the API boundary |
| Testing | pytest-asyncio, httpx, SQLite in-memory | 27 tests with mocked Redis and isolated test DB |
| CI/CD | GitHub Actions | Tests run on every push and PR |
| Deployment | Render (backend), Vercel (frontend), Neon (DB), Upstash (Redis) | Free-tier stack with auto-deploy from GitHub |

## Run locally

```bash
git clone https://github.com/abhi-00g/syncboard.git
cd syncboard

# Start backend (PostgreSQL + Redis + FastAPI)
docker compose up --build -d

# Start frontend
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to the Docker backend automatically.

## Run tests

```bash
# Install test dependencies
cd backend
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx aiosqlite

# Run from the project root
cd ..
python -m pytest -v
```

Tests use an in-memory SQLite database with `StaticPool` so all connections share one database. Redis is mocked via `patch.object` on the singleton service — no Redis server needed to run tests.

## Environment variables

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis connection string (`rediss://...` for TLS) |
| `JWT_SECRET_KEY` | Random secret for signing JWT tokens |
| `ENVIRONMENT` | `development` or `production` |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (production only — dev uses proxy) |
| `VITE_WS_URL` | Backend WebSocket URL (production only — dev uses proxy) |

## Project structure

```
syncboard/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy models (9 tables)
│   │   ├── routers/         # FastAPI route handlers + WebSocket
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic (auth, board, card)
│   │   ├── realtime/        # Redis pub/sub, connection manager, events
│   │   ├── config.py        # Pydantic Settings (env vars)
│   │   ├── database.py      # Async engine + session factory
│   │   ├── dependencies.py  # FastAPI dependency injection (auth, db)
│   │   └── main.py          # App factory, CORS, lifespan
│   ├── alembic/             # Database migrations
│   ├── tests/               # 27 pytest tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # Landing, Login, Register, BoardList, BoardView
│   │   ├── components/      # CardDetailModal, ActivitySidebar
│   │   ├── hooks/           # useWebSocket (auto-reconnect + heartbeat)
│   │   ├── context/         # AuthContext (JWT + localStorage)
│   │   ├── api/             # API client with 401 redirect
│   │   └── types/           # TypeScript interfaces matching backend schemas
│   ├── tailwind.config.js
│   └── vercel.json          # SPA rewrites
├── docker-compose.yml
├── pytest.ini
└── .github/workflows/ci.yml
```
