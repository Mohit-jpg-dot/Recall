"""
Recall API — Browser Connection Routes

Connect, pair, list, update, and disconnect browsers.
Supports secure single-use pairing token exchange for Chrome, Firefox, and Safari extensions.
"""

from datetime import datetime, timedelta, timezone
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import BrowserConnection, User
from app.schemas.schemas import (
    BrowserConnectRequest,
    BrowserConnectionResponse,
    BrowserPairRequest,
    BrowserPairResponse,
    BrowserUpdateRequest,
    MessageResponse,
)
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/browsers", tags=["browsers"])


@router.post("/connect", response_model=BrowserConnectionResponse, status_code=status.HTTP_201_CREATED)
async def connect_browser(
    request: BrowserConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new browser connection and generate a secure pairing token.

    The returned connection_token is formatted as: recall_<conn_id_hex>_<secret>
    which can be entered into any supported extension popup (Chrome, Firefox, Safari).
    """
    conn_id = uuid.uuid4()
    secret = secrets.token_urlsafe(24)
    pairing_token = f"recall_{conn_id.hex}_{secret}"

    connection = BrowserConnection(
        id=conn_id,
        user_id=user.id,
        browser_type=request.browser_type,
        connection_name=request.connection_name,
        auth_token_hash=hash_password(secret),
        is_active=True,
        is_paused=False,
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)

    return BrowserConnectionResponse(
        id=connection.id,
        browser_type=connection.browser_type,
        connection_name=connection.connection_name,
        is_active=connection.is_active,
        is_paused=connection.is_paused,
        last_synced_at=connection.last_synced_at,
        created_at=connection.created_at,
        connection_token=pairing_token,  # Single-use pairing token
    )


from app.middleware.rate_limiter import RateLimiter

pair_limiter = RateLimiter(requests=20, window_seconds=60, key_prefix="browser_pair")


@router.post("/pair", response_model=BrowserPairResponse, dependencies=[Depends(pair_limiter)])
async def pair_browser(
    request: BrowserPairRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a pairing token generated from the web dashboard for authenticated browser tokens.

    Validates:
    - Token format: recall_<conn_id_hex>_<secret>
    - Existence of active connection
    - Cryptographic hash verification of the secret
    - Expiration window (15 minutes maximum from generation)
    """
    token = request.pairing_token.strip()
    parts = token.split("_", 2)
    if len(parts) != 3 or parts[0] != "recall":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pairing token format. Expected recall_<id>_<secret>",
        )

    try:
        conn_id = uuid.UUID(parts[1])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pairing token connection identifier",
        )

    secret = parts[2]

    # Find connection
    res = await db.execute(
        select(BrowserConnection).where(
            BrowserConnection.id == conn_id,
            BrowserConnection.is_active == True,
        )
    )
    connection = res.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pairing connection not found or already revoked",
        )

    # Verify secret
    if not verify_password(secret, connection.auth_token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid pairing token secret",
        )

    # Check expiration (15-minute validity window)
    now = datetime.now(timezone.utc)
    created = connection.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if now - created > timedelta(minutes=15):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pairing token has expired (valid for 15 minutes)",
        )

    # Update browser type / name if provided
    if request.browser_type:
        connection.browser_type = request.browser_type
    if request.connection_name:
        connection.connection_name = request.connection_name
    connection.last_synced_at = now

    # Generate dedicated tokens for this user
    access_token = create_access_token(connection.user_id)
    refresh_token = create_refresh_token(connection.user_id)

    await db.commit()

    return BrowserPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        connection_id=connection.id,
        browser_type=connection.browser_type,
        connection_name=connection.connection_name,
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

    await db.commit()
    await db.refresh(connection)

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
    await db.commit()
    return MessageResponse(message="Browser disconnected")
