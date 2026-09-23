"""
Recall API — Main Application

FastAPI application with CORS, request tracing, safe error handling,
background embedding worker, and full multi-tenant route registration.
"""

from contextlib import asynccontextmanager
import logging
import time
import uuid

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, init_db
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
from app.services.embedding_service import start_embedding_worker, stop_embedding_worker

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
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)


# ── Pure ASGI Request Tracing & Timing Middleware ────────────────────────────
class RequestTracingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Extract or generate unique request ID
        req_id = str(uuid.uuid4())
        for header_name, header_val in scope.get("headers", []):
            if header_name.lower() == b"x-request-id":
                req_id = header_val.decode("latin1")
                break

        start_time = time.time()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", req_id.encode("latin1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            path = scope.get("path", "")
            if not path.startswith("/api/health"):
                logger.info("[%s] %s %s in %sms", req_id[:8], scope.get("method"), path, duration_ms)


app.add_middleware(RequestTracingMiddleware)


# ── Safe Production Error Handler ────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catches unhandled errors and returns sanitized messages without leaking credentials or traces."""
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    req_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    logger.error("Unhandled server error [req_id=%s]: %s", req_id, exc, exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please try again later.",
            "request_id": req_id,
        },
    )


# ── CORS ─────────────────────────────────────────────────────────────────────
# Allowed web origins and browser extensions (Chrome, Firefox, Safari)
cors_origins = settings.cors_origins if settings.cors_origins else ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^(http://localhost:\d+|http://127\.0\.0\.1:\d+|chrome-extension://.*|moz-extension://.*|safari-web-extension://.*)",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["x-request-id"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
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


# ── Observability & Health Endpoints ─────────────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health_check():
    """Basic service health check."""
    return {"status": "ok", "service": "recall-api", "version": "1.0.0"}


@app.get("/api/health/db", tags=["health"])
async def health_check_database(db: AsyncSession = Depends(get_db)):
    """Database connectivity health check."""
    try:
        res = await db.execute(text("SELECT 1"))
        val = res.scalar()
        if val == 1:
            return {"status": "ok", "component": "postgresql"}
        raise ValueError("Invalid check result")
    except Exception as e:
        logger.error("Database health check failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        )


@app.get("/api/health/redis", tags=["health"])
async def health_check_redis():
    """Redis connectivity health check."""
    from app.middleware.rate_limiter import get_redis_client
    redis = get_redis_client()
    if not redis:
        return {"status": "degraded", "component": "redis", "message": "Using in-memory fallback"}
    try:
        pong = await redis.ping()
        if pong:
            return {"status": "ok", "component": "redis"}
        raise ValueError("No ping response")
    except Exception as e:
        logger.warning("Redis ping check failed: %s", e)
        return {"status": "degraded", "component": "redis", "message": "Using in-memory fallback"}
