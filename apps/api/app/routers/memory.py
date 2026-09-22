"""
Recall API — Memory & Timeline Routes

List memories, delete memories, view timeline.
"""

import uuid
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import (
    BrowsingEvent,
    Domain,
    MemoryDeletion,
    Page,
    User,
)
from app.schemas.schemas import (
    MemoryListResponse,
    MemoryResponse,
    MessageResponse,
    TimelineGroup,
    TimelinePage,
    TimelineResponse,
    TimelineSession,
)

router = APIRouter(prefix="/api", tags=["memory"])


@router.get("/memory", response_model=MemoryListResponse)
async def list_memories(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = None,
    domain: Optional[str] = None,
    browser: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's memories with cursor-based pagination."""
    query = (
        select(BrowsingEvent)
        .options(joinedload(BrowsingEvent.page).joinedload(Page.domain))
        .where(BrowsingEvent.user_id == user.id)
    )

    # Apply cursor (timestamp-based)
    if cursor:
        try:
            cursor_time = datetime.fromisoformat(cursor)
            query = query.where(BrowsingEvent.visited_at < cursor_time)
        except ValueError:
            pass

    # Apply filters
    if domain:
        query = query.join(Page).join(Domain).where(Domain.domain_name == domain)
    if browser:
        query = query.where(BrowsingEvent.source_browser == browser)

    query = query.order_by(BrowsingEvent.visited_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    events = result.scalars().unique().all()

    has_more = len(events) > limit
    events = events[:limit]

    memories = []
    for event in events:
        page = event.page
        domain_obj = page.domain if page else None
        memories.append(
            MemoryResponse(
                id=event.id,
                url=page.url if page else "",
                title=page.title if page else None,
                domain=domain_obj.domain_name if domain_obj else "",
                domain_favicon=domain_obj.favicon_url if domain_obj else None,
                visited_at=event.visited_at,
                source_browser=event.source_browser,
            )
        )

    next_cursor = None
    if has_more and memories:
        next_cursor = memories[-1].visited_at.isoformat()

    # Get total count
    count_query = select(func.count(BrowsingEvent.id)).where(
        BrowsingEvent.user_id == user.id
    )
    total = (await db.execute(count_query)).scalar() or 0

    return MemoryListResponse(
        memories=memories,
        total=total,
        has_more=has_more,
        cursor=next_cursor,
    )


@router.delete("/memory/{memory_id}", response_model=MessageResponse)
async def delete_memory(
    memory_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single memory (browsing event)."""
    result = await db.execute(
        select(BrowsingEvent).where(
            BrowsingEvent.id == memory_id,
            BrowsingEvent.user_id == user.id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    await db.delete(event)

    # Audit log
    deletion = MemoryDeletion(
        user_id=user.id,
        deletion_type="single",
        deletion_criteria={"memory_id": str(memory_id)},
        items_deleted=1,
    )
    db.add(deletion)

    return MessageResponse(message="Memory deleted")


@router.delete("/memory/date/{target_date}", response_model=MessageResponse)
async def delete_memories_by_date(
    target_date: date,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all memories for a specific date."""
    start = datetime.combine(target_date, datetime.min.time())
    end = datetime.combine(target_date, datetime.max.time())

    # Count first
    count_result = await db.execute(
        select(func.count(BrowsingEvent.id)).where(
            and_(
                BrowsingEvent.user_id == user.id,
                BrowsingEvent.visited_at >= start,
                BrowsingEvent.visited_at <= end,
            )
        )
    )
    count = count_result.scalar() or 0

    # Delete
    await db.execute(
        delete(BrowsingEvent).where(
            and_(
                BrowsingEvent.user_id == user.id,
                BrowsingEvent.visited_at >= start,
                BrowsingEvent.visited_at <= end,
            )
        )
    )

    # Audit log
    deletion = MemoryDeletion(
        user_id=user.id,
        deletion_type="date",
        deletion_criteria={"date": str(target_date)},
        items_deleted=count,
    )
    db.add(deletion)

    return MessageResponse(message=f"Deleted {count} memories from {target_date}")


@router.get("/timeline", response_model=TimelineResponse)
async def get_timeline(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get chronological timeline of browsing events grouped by date and session."""
    query = (
        select(BrowsingEvent)
        .options(joinedload(BrowsingEvent.page).joinedload(Page.domain))
        .where(BrowsingEvent.user_id == user.id)
    )

    if date_from:
        try:
            query = query.where(BrowsingEvent.visited_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            query = query.where(BrowsingEvent.visited_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass
    if cursor:
        try:
            cursor_time = datetime.fromisoformat(cursor)
            query = query.where(BrowsingEvent.visited_at < cursor_time)
        except ValueError:
            pass

    query = query.order_by(BrowsingEvent.visited_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    events = result.scalars().unique().all()

    has_more = len(events) > limit
    events = events[:limit]

    # Group by date
    from collections import defaultdict
    date_groups: dict[str, list] = defaultdict(list)

    for event in events:
        page = event.page
        domain_obj = page.domain if page else None
        date_key = event.visited_at.strftime("%B %d, %Y")  # "September 22, 2026"
        date_groups[date_key].append(
            TimelinePage(
                id=event.id,
                title=page.title if page else None,
                domain=domain_obj.domain_name if domain_obj else "",
                url=page.url if page else "",
                visited_at=event.visited_at,
            )
        )

    # Build response groups (simple time-based grouping for Phase 1)
    groups = []
    for date_key, pages in date_groups.items():
        # Group pages into sessions by time proximity (30-min gaps)
        sessions = []
        current_session_pages = []

        for i, page in enumerate(pages):
            if i == 0:
                current_session_pages.append(page)
                continue

            prev_time = pages[i - 1].visited_at
            gap = abs((page.visited_at - prev_time).total_seconds())

            if gap > 1800:  # 30-minute gap = new session
                sessions.append(
                    TimelineSession(
                        time=current_session_pages[0].visited_at.strftime("%-I:%M %p"),
                        pages=current_session_pages,
                    )
                )
                current_session_pages = [page]
            else:
                current_session_pages.append(page)

        if current_session_pages:
            sessions.append(
                TimelineSession(
                    time=current_session_pages[0].visited_at.strftime("%-I:%M %p"),
                    pages=current_session_pages,
                )
            )

        groups.append(TimelineGroup(date=date_key, sessions=sessions))

    next_cursor = None
    if has_more and events:
        next_cursor = events[-1].visited_at.isoformat()

    return TimelineResponse(groups=groups, has_more=has_more, cursor=next_cursor)
