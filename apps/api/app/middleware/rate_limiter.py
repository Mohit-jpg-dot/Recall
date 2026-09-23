"""
Recall API — Rate Limiting Middleware & Dependency

Provides token-bucket / sliding window rate limiting.
Uses Redis when available, falling back gracefully to in-memory sliding window.
Protects sensitive authentication, browser pairing, and AI endpoints.
"""

from collections import defaultdict
import logging
import time
from typing import Callable, Optional

from fastapi import HTTPException, Request, status
from app.config import settings

logger = logging.getLogger("recall.rate_limiter")

# In-memory sliding window fallback: key -> list of timestamps
_in_memory_hits: dict[str, list[float]] = defaultdict(list)
_redis_client = None


def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(settings.redis_url, socket_timeout=1.0)
        except Exception as e:
            logger.warning("Could not initialize Redis client for rate limiting: %s", e)
            _redis_client = False
    return _redis_client if _redis_client is not False else None


class RateLimiter:
    """Rate limiter dependency specifying max requests per time window."""

    def __init__(self, requests: int, window_seconds: int = 60, key_prefix: str = "rl"):
        self.requests = requests
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix

    async def __call__(self, request: Request):
        # Extract client identifier: X-Forwarded-For header, or client IP
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        # If user is authenticated, combine with authorization header hash or user tag
        auth_header = request.headers.get("authorization", "")
        identifier = f"{client_ip}:{hash(auth_header) if auth_header else 'anon'}"
        key = f"{self.key_prefix}:{identifier}"

        now = time.time()
        allowed = await self._check_rate_limit(key, now)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: maximum {self.requests} requests per {self.window_seconds} seconds.",
                headers={"Retry-After": str(self.window_seconds)},
            )

    async def _check_rate_limit(self, key: str, now: float) -> bool:
        redis = get_redis_client()
        if redis:
            try:
                pipeline = redis.pipeline()
                pipeline.zremrangebyscore(key, 0, now - self.window_seconds)
                pipeline.zadd(key, {str(now): now})
                pipeline.zcard(key)
                pipeline.expire(key, self.window_seconds)
                results = await pipeline.execute()
                count = results[2]
                return count <= self.requests
            except Exception as e:
                # If Redis times out, fallback to in-memory check without crashing
                logger.debug("Redis rate limiter check error (%s), using in-memory", e)

        # In-memory sliding window fallback
        timestamps = _in_memory_hits[key]
        cutoff = now - self.window_seconds
        # Filter expired timestamps
        valid = [t for t in timestamps if t > cutoff]
        if len(valid) >= self.requests:
            _in_memory_hits[key] = valid
            return False
        valid.append(now)
        _in_memory_hits[key] = valid
        return True
