"""
Recall API — Asynchronous Embedding Service & Background Worker

Generates and stores vector embeddings for pages asynchronously.
Browsing ingestion is NEVER blocked by embedding generation.
Pipeline:
  Browsing Event -> Store -> Enqueue Page ID -> Worker -> Generate Embedding -> Store Vector
"""

import asyncio
import hashlib
import logging
import math
import uuid
from typing import Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models.models import Page, PageEmbedding

logger = logging.getLogger("recall.embeddings")

# In-memory queue for page embedding tasks
_embedding_queue: asyncio.Queue[uuid.UUID] = asyncio.Queue(maxsize=10000)
_worker_task: Optional[asyncio.Task] = None
_stop_event = asyncio.Event()


def generate_deterministic_embedding(text: str, dim: int = 1536) -> list[float]:
    """
    Generate a normalized deterministic 1536-dimensional vector for offline / test environments
    or when OpenAI API key is unavailable.
    Uses multi-hash projection with unit sphere normalization.
    """
    if not text:
        vec = [0.0] * dim
        vec[0] = 1.0
        return vec

    tokens = [t.lower() for t in text.split() if len(t.strip()) > 1]
    if not tokens:
        tokens = [text.lower()]

    vector = np.zeros(dim, dtype=np.float32)

    for i, token in enumerate(tokens):
        # Generate stable bucket index and sign
        h1 = int(hashlib.md5(f"t1:{token}".encode("utf-8")).hexdigest(), 16)
        h2 = int(hashlib.sha256(f"t2:{token}".encode("utf-8")).hexdigest(), 16)
        idx = h1 % dim
        sign = 1.0 if (h2 % 2 == 0) else -1.0
        # Decay later tokens slightly
        weight = 1.0 / (1.0 + 0.1 * math.log(i + 1))
        vector[idx] += sign * weight

    # Normalize to unit length for cosine similarity
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    else:
        vector[0] = 1.0

    return vector.tolist()


async def get_embedding_for_text(text: str) -> list[float]:
    """
    Get embedding for text using OpenAI if configured, otherwise deterministic projection.
    """
    cleaned = (text or "").strip()[:8000]
    if not cleaned:
        cleaned = "empty"

    if settings.openai_api_key:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "input": cleaned,
                        "model": settings.openai_embedding_model,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    return data["data"][0]["embedding"]
        except Exception as e:
            logger.warning("OpenAI embedding API call failed (%s), using local fallback", e)

    return generate_deterministic_embedding(cleaned, dim=1536)


async def enqueue_page_embedding(page_id: uuid.UUID) -> bool:
    """
    Enqueue a page ID for async embedding generation without blocking ingestion.
    """
    try:
        _embedding_queue.put_nowait(page_id)
        return True
    except asyncio.QueueFull:
        logger.warning("Embedding queue full, dropping immediate queue for page %s", page_id)
        return False


async def process_single_page_embedding(db: AsyncSession, page_id: uuid.UUID) -> bool:
    """
    Generate and store vector embedding for a single page.
    """
    # Check if page exists
    page_res = await db.execute(select(Page).where(Page.id == page_id))
    page = page_res.scalar_one_or_none()
    if not page:
        return False

    # Check if embedding already exists
    emb_res = await db.execute(select(PageEmbedding).where(PageEmbedding.page_id == page_id))
    existing_emb = emb_res.scalar_one_or_none()

    text_to_embed = f"{page.title or ''} {page.url} {page.content_text or ''}".strip()
    vector = await get_embedding_for_text(text_to_embed)

    model_name = settings.openai_embedding_model if settings.openai_api_key else "recall-deterministic-v1"

    if existing_emb:
        existing_emb.embedding = vector
        existing_emb.model_name = model_name
    else:
        new_emb = PageEmbedding(
            id=uuid.uuid4(),
            page_id=page_id,
            embedding=vector,
            model_name=model_name,
        )
        db.add(new_emb)

    await db.commit()
    return True


async def embedding_worker_loop():
    """
    Continuous background worker loop processing queued page embeddings.
    """
    logger.info("Recall embedding background worker started.")
    while not _stop_event.is_set():
        try:
            # Wait for next item with timeout to check stop event
            try:
                page_id = await asyncio.wait_for(_embedding_queue.get(), timeout=2.0)
            except asyncio.TimeoutError:
                continue

            # Process with database session
            async with async_session() as db:
                try:
                    await process_single_page_embedding(db, page_id)
                except Exception as e:
                    logger.error("Error processing embedding for page %s: %s", page_id, e)
                finally:
                    _embedding_queue.task_done()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Unexpected error in embedding worker: %s", e)
            await asyncio.sleep(1.0)

    logger.info("Recall embedding background worker stopped.")


def start_embedding_worker():
    """Start the background embedding worker."""
    global _worker_task, _stop_event
    _stop_event.clear()
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(embedding_worker_loop())


async def stop_embedding_worker():
    """Gracefully stop the background embedding worker."""
    global _worker_task, _stop_event
    _stop_event.set()
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None
