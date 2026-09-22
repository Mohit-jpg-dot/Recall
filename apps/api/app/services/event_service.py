"""
Recall API — Event Service

Handles browsing event ingestion with deduplication,
domain exclusion filtering, and page identity separation.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    BrowserConnection,
    BrowsingEvent,
    Domain,
    ExcludedDomain,
    Page,
    SearchQuery,
)
from app.schemas.schemas import BrowsingEventPayload


def extract_search_query(url: str) -> Optional[tuple[str, str]]:
    """Extract search query and engine from a URL.

    Returns (query, engine) or None.
    """
    parsed = urlparse(url)
    domain = parsed.hostname or ""

    # Common search engine patterns
    search_patterns = {
        "google": ("google.com", "q"),
        "bing": ("bing.com", "q"),
        "duckduckgo": ("duckduckgo.com", "q"),
        "yahoo": ("search.yahoo.com", "p"),
        "youtube": ("youtube.com", "search_query"),
    }

    from urllib.parse import parse_qs

    params = parse_qs(parsed.query)

    for engine, (domain_pattern, param_key) in search_patterns.items():
        if domain_pattern in domain and param_key in params:
            query = params[param_key][0]
            if query:
                return (query, engine)

    return None


async def get_or_create_domain(db: AsyncSession, domain_name: str, favicon_url: Optional[str] = None) -> Domain:
    """Get existing domain or create a new one."""
    result = await db.execute(
        select(Domain).where(Domain.domain_name == domain_name)
    )
    domain = result.scalar_one_or_none()

    if not domain:
        domain = Domain(domain_name=domain_name, favicon_url=favicon_url)
        db.add(domain)
        await db.flush()

    return domain


async def get_or_create_page(
    db: AsyncSession,
    url: str,
    title: Optional[str],
    domain: Domain,
    metadata: Optional[dict] = None,
) -> Page:
    """Get existing page by URL or create a new one.

    If the page exists, update title and last_seen_at.
    """
    result = await db.execute(select(Page).where(Page.url == url))
    page = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if page:
        # Update with latest info
        if title and title != page.title:
            page.title = title
        page.last_seen_at = now
        if metadata:
            page.page_metadata = {**(page.page_metadata or {}), **metadata}
    else:
        page = Page(
            url=url,
            title=title,
            domain_id=domain.id,
            metadata=metadata,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(page)
        await db.flush()

    return page


async def is_domain_excluded(
    db: AsyncSession, user_id: uuid.UUID, domain_name: str
) -> bool:
    """Check if a domain is in the user's exclusion list."""
    result = await db.execute(
        select(ExcludedDomain).where(
            and_(
                ExcludedDomain.user_id == user_id,
                ExcludedDomain.domain_name == domain_name,
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def is_duplicate_event(
    db: AsyncSession,
    user_id: uuid.UUID,
    page_id: uuid.UUID,
    visited_at: datetime,
    window_seconds: int = 30,
) -> bool:
    """Check if a similar event already exists within a time window."""
    window_start = visited_at - timedelta(seconds=window_seconds)
    window_end = visited_at + timedelta(seconds=window_seconds)

    result = await db.execute(
        select(BrowsingEvent).where(
            and_(
                BrowsingEvent.user_id == user_id,
                BrowsingEvent.page_id == page_id,
                BrowsingEvent.visited_at >= window_start,
                BrowsingEvent.visited_at <= window_end,
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def ingest_events(
    db: AsyncSession,
    user_id: uuid.UUID,
    connection_id: uuid.UUID,
    events: list[BrowsingEventPayload],
) -> tuple[int, int, list[str]]:
    """Ingest a batch of browsing events.

    Returns (accepted_count, rejected_count, errors).
    Handles deduplication, domain exclusion, and page/domain creation.
    """
    accepted = 0
    rejected = 0
    errors: list[str] = []

    # Verify connection belongs to user and is active
    result = await db.execute(
        select(BrowserConnection).where(
            and_(
                BrowserConnection.id == connection_id,
                BrowserConnection.user_id == user_id,
                BrowserConnection.is_active == True,
                BrowserConnection.is_paused == False,
            )
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        return 0, len(events), ["Browser connection not found, inactive, or paused"]

    for event in events:
        try:
            # Check domain exclusion
            if await is_domain_excluded(db, user_id, event.domain):
                rejected += 1
                continue

            # Get or create domain
            favicon_url = event.metadata.favicon_url if event.metadata else None
            domain = await get_or_create_domain(db, event.domain, favicon_url)

            # Get or create page (deduplication by URL)
            meta_dict = event.metadata.model_dump() if event.metadata else None
            page = await get_or_create_page(db, event.url, event.title, domain, meta_dict)

            # Check for duplicate event
            if await is_duplicate_event(db, user_id, page.id, event.visited_at):
                rejected += 1
                continue

            # Create browsing event
            browsing_event = BrowsingEvent(
                user_id=user_id,
                browser_connection_id=connection_id,
                page_id=page.id,
                visited_at=event.visited_at,
                source_browser=event.source_browser,
                metadata=meta_dict,
            )
            db.add(browsing_event)
            await db.flush()

            # Extract and store search query if present
            search_result = extract_search_query(event.url)
            if search_result:
                query_text, engine = search_result
                search_query = SearchQuery(
                    user_id=user_id,
                    browsing_event_id=browsing_event.id,
                    query_text=query_text,
                    search_engine=engine,
                    searched_at=event.visited_at,
                )
                db.add(search_query)
            elif event.metadata and event.metadata.search_query:
                search_query = SearchQuery(
                    user_id=user_id,
                    browsing_event_id=browsing_event.id,
                    query_text=event.metadata.search_query,
                    search_engine=event.metadata.search_engine,
                    searched_at=event.visited_at,
                )
                db.add(search_query)

            accepted += 1

        except Exception as e:
            rejected += 1
            errors.append(f"Error processing event {event.url}: {str(e)}")

    # Update last_synced_at on the connection
    connection.last_synced_at = datetime.now(timezone.utc)

    return accepted, rejected, errors
