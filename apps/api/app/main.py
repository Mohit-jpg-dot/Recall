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


import time
import logging
from app.services.embedding_service import start_embedding_worker, stop_embedding_worker
from fastapi import Request

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("recall.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle events."""
    # Startup: initialize database tables & indexes
    await init_db()
    # Start background embedding worker
    start_embedding_worker()
    yield
    # Shutdown: gracefully stop background workers
    await stop_embedding_worker()


app = FastAPI(
    title="Recall API",
    description="Personal memory layer for the web",
    version="0.1.0",
    lifespan=lifespan,
)

# ── Pure ASGI Request Timing Middleware ────────
class TimingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        await self.app(scope, receive, send)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        path = scope.get("path", "")
        if path != "/api/health":
            logger.info("%s %s in %sms", scope.get("method"), path, duration_ms)

app.add_middleware(TimingMiddleware)

# ── CORS ─────────────────────────────────────────
# Allow web client, chrome/firefox/safari extensions
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(http://localhost:\d+|http://127\.0\.0\.1:\d+|chrome-extension://.*|moz-extension://.*|safari-web-extension://.*)",
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
