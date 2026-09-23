"""
Recall API — Auth Routes

Registration, login, logout, and token refresh.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.schemas import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    UserProfile,
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_user,
    decode_token,
    get_user_by_email,
    get_user_by_id,
)
from app.middleware.rate_limiter import RateLimiter

import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])

reg_limiter = RateLimiter(requests=15, window_seconds=60, key_prefix="auth_reg")
login_limiter = RateLimiter(requests=30, window_seconds=60, key_prefix="auth_login")
refresh_limiter = RateLimiter(requests=60, window_seconds=60, key_prefix="auth_refresh")


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(reg_limiter)],
)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    # Check if email already exists
    existing = await get_user_by_email(db, request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = await create_user(db, request.email, request.password, request.display_name)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
            memory_count=0,
            connected_browsers=0,
        ),
    )


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(login_limiter)])
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with email and password."""
    user = await authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Count memories and browsers for profile
    from sqlalchemy import select, func
    from app.models.models import BrowsingEvent, BrowserConnection

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

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
            memory_count=memory_count,
            connected_browsers=browser_count,
        ),
    )


@router.post("/refresh", response_model=AuthResponse, dependencies=[Depends(refresh_limiter)])
async def refresh_token(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh an access token using a valid refresh token."""
    payload = decode_token(request.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)

    return AuthResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
        ),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout():
    """Log out (client-side token deletion)."""
    return MessageResponse(message="Logged out successfully")
