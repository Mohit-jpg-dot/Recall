"""
Recall API — Browser Connection Routes

Connect, list, update, and disconnect browsers.
"""

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import BrowserConnection, User
from app.schemas.schemas import (
    BrowserConnectRequest,
    BrowserConnectionResponse,
    BrowserUpdateRequest,
    MessageResponse,
)
from app.services.auth_service import hash_password

router = APIRouter(prefix="/api/browsers", tags=["browsers"])


@router.post("/connect", response_model=BrowserConnectionResponse, status_code=status.HTTP_201_CREATED)
async def connect_browser(
    request: BrowserConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new browser connection. Returns a connection token for the extension."""
    # Generate a unique connection token
    connection_token = secrets.token_urlsafe(48)

    connection = BrowserConnection(
        user_id=user.id,
        browser_type=request.browser_type,
        connection_name=request.connection_name,
        auth_token_hash=hash_password(connection_token),
        is_active=True,
        is_paused=False,
    )
    db.add(connection)
    await db.flush()

    return BrowserConnectionResponse(
        id=connection.id,
        browser_type=connection.browser_type,
        connection_name=connection.connection_name,
        is_active=connection.is_active,
        is_paused=connection.is_paused,
        last_synced_at=connection.last_synced_at,
        created_at=connection.created_at,
        connection_token=connection_token,  # Only returned once
    )


@router.get("", response_model=list[BrowserConnectionResponse])
async def list_browsers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all connected browsers for the current user."""
    result = await db.execute(
        select(BrowserConnection).where(
            BrowserConnection.user_id == user.id,
            BrowserConnection.is_active == True,
        ).order_by(BrowserConnection.created_at.desc())
    )
    connections = result.scalars().all()

    return [
        BrowserConnectionResponse(
            id=c.id,
            browser_type=c.browser_type,
            connection_name=c.connection_name,
            is_active=c.is_active,
            is_paused=c.is_paused,
            last_synced_at=c.last_synced_at,
            created_at=c.created_at,
        )
        for c in connections
    ]


@router.patch("/{connection_id}", response_model=BrowserConnectionResponse)
async def update_browser(
    connection_id: uuid.UUID,
    request: BrowserUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a browser connection (pause/resume, rename)."""
    result = await db.execute(
        select(BrowserConnection).where(
            BrowserConnection.id == connection_id,
            BrowserConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")

    if request.is_paused is not None:
        connection.is_paused = request.is_paused
    if request.connection_name is not None:
        connection.connection_name = request.connection_name

    return BrowserConnectionResponse(
        id=connection.id,
        browser_type=connection.browser_type,
        connection_name=connection.connection_name,
        is_active=connection.is_active,
        is_paused=connection.is_paused,
        last_synced_at=connection.last_synced_at,
        created_at=connection.created_at,
    )


@router.delete("/{connection_id}", response_model=MessageResponse)
async def disconnect_browser(
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect a browser (soft delete)."""
    result = await db.execute(
        select(BrowserConnection).where(
            BrowserConnection.id == connection_id,
            BrowserConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")

    connection.is_active = False
    return MessageResponse(message="Browser disconnected")
