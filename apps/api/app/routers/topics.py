"""
Recall API — Topics Router

Endpoints for managing and discovering memory topics.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import MemoryTopic, PageTopic, Page, BrowsingEvent, User
from app.schemas.schemas import TopicResponse, TopicUpdate, MessageResponse, MemoryResponse

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicResponse])
async def list_topics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List topics auto-categorized or created by the user."""
    stmt = (
        select(MemoryTopic)
        .where(MemoryTopic.user_id == user.id)
        .options(selectinload(MemoryTopic.pages))
        .order_by(MemoryTopic.name.asc())
    )
    result = await db.execute(stmt)
    topics = result.scalars().all()

    response_items = []
    for t in topics:
        response_items.append(
            TopicResponse(
                id=t.id,
                name=t.name,
                slug=t.slug,
                color=t.color or "#6366F1",
                page_count=len(t.pages) if t.pages else 0,
                is_auto_generated=t.is_auto_generated,
            )
        )
    return response_items


@router.get("/{slug}/memories", response_model=list[MemoryResponse])
async def get_topic_memories(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all memories tagged under a topic."""
    # Find topic
    stmt = select(MemoryTopic).where(
        MemoryTopic.slug == slug,
        MemoryTopic.user_id == user.id,
    )
    res = await db.execute(stmt)
    topic = res.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    # Get events for pages in this topic
    events_stmt = (
        select(BrowsingEvent)
        .join(BrowsingEvent.page)
        .join(Page.topics)
        .where(
            PageTopic.topic_id == topic.id,
            BrowsingEvent.user_id == user.id,
        )
        .options(joinedload(BrowsingEvent.page).joinedload(Page.domain))
        .order_by(desc(BrowsingEvent.visited_at))
        .limit(50)
    )
    result = await db.execute(events_stmt)
    events = result.scalars().unique().all()

    memories = []
    for ev in events:
        page = ev.page
        domain_obj = page.domain if page else None
        memories.append(
            MemoryResponse(
                id=ev.id,
                url=page.url if page else "",
                title=page.title if page else "",
                domain=domain_obj.domain_name if domain_obj else "",
                domain_favicon=domain_obj.favicon_url if domain_obj else None,
                visited_at=ev.visited_at,
                source_browser=ev.source_browser or "chrome",
                duration_seconds=ev.duration_seconds,
            )
        )
    return memories


@router.patch("/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: uuid.UUID,
    body: TopicUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update topic name or color."""
    stmt = select(MemoryTopic).where(
        MemoryTopic.id == topic_id,
        MemoryTopic.user_id == user.id,
    )
    result = await db.execute(stmt)
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    if body.name is not None:
        topic.name = body.name
    if body.color is not None:
        topic.color = body.color

    await db.commit()
    await db.refresh(topic)

    return TopicResponse(
        id=topic.id,
        name=topic.name,
        slug=topic.slug,
        color=topic.color,
        page_count=0,
        is_auto_generated=topic.is_auto_generated,
    )
