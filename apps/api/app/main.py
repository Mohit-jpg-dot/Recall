"""
Recall API — Main Application

FastAPI application with CORS, auth middleware, and complete route registration.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
    auth,
    browsers,
    chat,
    events,
    memory,
    privacy,
    search,
    sessions,
    topics,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle events."""
    # Startup: initialize database tables
    await init_db()
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="Recall API",
    description="Personal memory layer for the web",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local dev & extensions
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Routes ───────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(browsers.router)
app.include_router(events.router)
app.include_router(memory.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(topics.router)
app.include_router(sessions.router)
app.include_router(privacy.router)


# ── Health Check ─────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "recall-api"}
