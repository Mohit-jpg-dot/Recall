"""
Recall API — User Routes

Profile management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import BrowserConnection, BrowsingEvent, User
from app.schemas.schemas import MessageResponse, UserProfile, UserUpdate

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile with stats."""
    memory_count_result = await db.execute(
        select(func.count(BrowsingEvent.id)).where(BrowsingEvent.user_id == user.id)
    )
    memory_count = memory_count_result.scalar() or 0

    browser_count_result = await db.execute(
        select(func.count(BrowserConnection.id)).where(
            BrowserConnection.user_id == user.id,
            BrowserConnection.is_active == True,
        )
    )
    browser_count = browser_count_result.scalar() or 0

    return UserProfile(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        memory_count=memory_count,
        connected_browsers=browser_count,
    )


@router.patch("/me", response_model=UserProfile)
async def update_profile(
    request: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile."""
    if request.display_name is not None:
        user.display_name = request.display_name

    return UserProfile(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
    )


@router.delete("/me", response_model=MessageResponse)
async def delete_account(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete user account and ALL associated data.

    This cascades to: browser connections, browsing events,
    conversations, topics, preferences, and excluded domains.
    """
    await db.delete(user)
    await db.commit()
    return MessageResponse(message="Account and all data deleted")
