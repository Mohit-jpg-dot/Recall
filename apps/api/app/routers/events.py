"""
Recall API — Event Ingestion Routes

Batch endpoint for browser extensions to submit browsing events.
Returns quickly — heavy processing happens in background workers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User
from app.schemas.schemas import BatchEventsRequest, BatchEventsResponse
from app.services.event_service import ingest_events

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("/batch", response_model=BatchEventsResponse)
async def batch_ingest(
    request: BatchEventsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest a batch of browsing events from a browser extension.

    - Validates connection ownership
    - Filters excluded domains
    - Deduplicates recent events
    - Separates page identity from visit events
    - Extracts search queries from URLs
    - Returns quickly (embeddings/topics processed asynchronously)
    """
    accepted, rejected, errors = await ingest_events(
        db=db,
        user_id=user.id,
        connection_id=request.connection_id,
        events=request.events,
    )

    if accepted == 0 and rejected == len(request.events) and errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0],
        )

    return BatchEventsResponse(
        accepted=accepted,
        rejected=rejected,
        errors=errors[:5],  # Limit error messages
    )
