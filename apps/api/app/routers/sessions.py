"""
Recall API — Research Sessions Router

Endpoints for exploring coherent browsing research journeys.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import BrowsingSession, BrowsingEvent, Page, Domain, User
from app.schemas.schemas import ResearchSessionResponse, SessionPageResponse

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=list[ResearchSessionResponse])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List research sessions with journey history."""
    stmt = (
        select(BrowsingSession)
        .where(BrowsingSession.user_id == user.id)
        .options(
            selectinload(BrowsingSession.events)
            .joinedload(BrowsingEvent.page)
            .joinedload(Page.domain)
        )
        .order_by(desc(BrowsingSession.started_at))
        .limit(30)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    items = []
    for s in sessions:
        evs = sorted(s.events or [], key=lambda e: e.visited_at)
        pages_list = []
        for e in evs:
            if e.page:
                pages_list.append(
                    SessionPageResponse(
                        title=e.page.title,
                        domain=e.page.domain.domain_name if e.page.domain else "",
                        url=e.page.url,
                        visited_at=e.visited_at,
                    )
                )

        items.append(
            ResearchSessionResponse(
                id=s.id,
                inferred_topic=s.inferred_topic or "Exploratory Session",
                page_count=len(pages_list),
                started_at=s.started_at,
                ended_at=s.ended_at or s.started_at,
                pages=pages_list,
            )
        )
    return items


@router.get("/{session_id}", response_model=ResearchSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single research session details."""
    stmt = (
        select(BrowsingSession)
        .where(
            BrowsingSession.id == session_id,
            BrowsingSession.user_id == user.id,
        )
        .options(
            selectinload(BrowsingSession.events)
            .joinedload(BrowsingEvent.page)
            .joinedload(Page.domain)
        )
    )
    result = await db.execute(stmt)
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    evs = sorted(s.events or [], key=lambda e: e.visited_at)
    pages_list = []
    for e in evs:
        if e.page:
            pages_list.append(
                SessionPageResponse(
                    title=e.page.title,
                    domain=e.page.domain.domain_name if e.page.domain else "",
                    url=e.page.url,
                    visited_at=e.visited_at,
                )
            )

    return ResearchSessionResponse(
        id=s.id,
        inferred_topic=s.inferred_topic or "Exploratory Session",
        page_count=len(pages_list),
        started_at=s.started_at,
        ended_at=s.ended_at or s.started_at,
        pages=pages_list,
    )
