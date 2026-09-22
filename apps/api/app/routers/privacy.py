"""
Recall API — Privacy Routes

Excluded domains management, privacy settings, data export.
"""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import (
    BrowsingEvent,
    ExcludedDomain,
    Page,
    User,
    UserPreference,
)
from app.schemas.schemas import (
    ExcludedDomainRequest,
    ExcludedDomainResponse,
    MessageResponse,
    PrivacySettingsResponse,
)

router = APIRouter(prefix="/api/privacy", tags=["privacy"])


@router.get("", response_model=PrivacySettingsResponse)
async def get_privacy_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's privacy settings."""
    # Check if memory is active (default: True)
    pref_result = await db.execute(
        select(UserPreference).where(
            and_(
                UserPreference.user_id == user.id,
                UserPreference.key == "memory_active",
            )
        )
    )
    pref = pref_result.scalar_one_or_none()
    memory_active = pref.value != "false" if pref else True

    # Get excluded domains
    result = await db.execute(
        select(ExcludedDomain)
        .where(ExcludedDomain.user_id == user.id)
        .order_by(ExcludedDomain.domain_name)
    )
    excluded = result.scalars().all()

    return PrivacySettingsResponse(
        memory_active=memory_active,
        excluded_domains=[
            ExcludedDomainResponse(
                id=d.id,
                domain_name=d.domain_name,
                created_at=d.created_at,
            )
            for d in excluded
        ],
    )


@router.patch("", response_model=MessageResponse)
async def update_privacy_settings(
    memory_active: bool,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update privacy settings (pause/resume memory)."""
    result = await db.execute(
        select(UserPreference).where(
            and_(
                UserPreference.user_id == user.id,
                UserPreference.key == "memory_active",
            )
        )
    )
    pref = result.scalar_one_or_none()

    if pref:
        pref.value = str(memory_active).lower()
    else:
        pref = UserPreference(
            user_id=user.id,
            key="memory_active",
            value=str(memory_active).lower(),
        )
        db.add(pref)

    action = "resumed" if memory_active else "paused"
    return MessageResponse(message=f"Memory {action}")


@router.get("/excluded-domains", response_model=list[ExcludedDomainResponse])
async def list_excluded_domains(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all excluded domains."""
    result = await db.execute(
        select(ExcludedDomain)
        .where(ExcludedDomain.user_id == user.id)
        .order_by(ExcludedDomain.domain_name)
    )
    return [
        ExcludedDomainResponse(
            id=d.id,
            domain_name=d.domain_name,
            created_at=d.created_at,
        )
        for d in result.scalars().all()
    ]


@router.post("/excluded-domains", response_model=ExcludedDomainResponse, status_code=status.HTTP_201_CREATED)
async def add_excluded_domain(
    request: ExcludedDomainRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a domain to the exclusion list."""
    # Check if already excluded
    existing = await db.execute(
        select(ExcludedDomain).where(
            and_(
                ExcludedDomain.user_id == user.id,
                ExcludedDomain.domain_name == request.domain_name,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Domain already excluded",
        )

    domain = ExcludedDomain(
        user_id=user.id,
        domain_name=request.domain_name,
    )
    db.add(domain)
    await db.flush()

    return ExcludedDomainResponse(
        id=domain.id,
        domain_name=domain.domain_name,
        created_at=domain.created_at,
    )


@router.delete("/excluded-domains/{domain_id}", response_model=MessageResponse)
async def remove_excluded_domain(
    domain_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a domain from the exclusion list."""
    result = await db.execute(
        select(ExcludedDomain).where(
            and_(
                ExcludedDomain.id == domain_id,
                ExcludedDomain.user_id == user.id,
            )
        )
    )
    domain = result.scalar_one_or_none()
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Excluded domain not found")

    await db.delete(domain)
    return MessageResponse(message="Domain removed from exclusion list")


@router.post("/export")
async def export_data(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all user data as JSON."""
    # Fetch all browsing events with pages
    result = await db.execute(
        select(BrowsingEvent)
        .options(joinedload(BrowsingEvent.page).joinedload(Page.domain))
        .where(BrowsingEvent.user_id == user.id)
        .order_by(BrowsingEvent.visited_at.desc())
    )
    events = result.scalars().unique().all()

    export_data = {
        "user": {
            "email": user.email,
            "display_name": user.display_name,
            "created_at": user.created_at.isoformat(),
        },
        "memories": [
            {
                "url": event.page.url if event.page else "",
                "title": event.page.title if event.page else None,
                "domain": event.page.domain.domain_name if event.page and event.page.domain else "",
                "visited_at": event.visited_at.isoformat(),
                "source_browser": event.source_browser,
            }
            for event in events
        ],
        "total_memories": len(events),
        "exported_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }

    content = json.dumps(export_data, indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=recall-export.json"},
    )
