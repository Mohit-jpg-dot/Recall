"""
Recall API — Search Router

Endpoints for natural language hybrid search over browsing memories.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User
from app.schemas.schemas import SearchRequest, SearchResponse
from app.services.search_service import search_memories

router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def perform_search(
    body: SearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Search personal web memory using natural language with temporal and domain understanding.
    """
    return await search_memories(
        db=db,
        user=user,
        query_str=body.query,
        filters=body.filters,
        limit=body.limit,
    )
