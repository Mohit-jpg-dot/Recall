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


from app.services.embedding_service import enqueue_page_embedding


async def get_user_excluded_domains_set(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    """Retrieve all excluded domain names for a user in a single fast query."""
    result = await db.execute(
        select(ExcludedDomain.domain_name).where(ExcludedDomain.user_id == user_id)
    )
    return set(result.scalars().all())


async def ingest_events(
    db: AsyncSession,
    user_id: uuid.UUID,
    connection_id: uuid.UUID,
    events: list[BrowsingEventPayload],
) -> tuple[int, int, list[str]]:
    """Ingest a batch of browsing events with high-performance batching.

    Returns (accepted_count, rejected_count, errors).
    - Single query for excluded domains
    - Bulk lookup & creation for domains and pages
    - Set-based deduplication in memory & database window
    - Single atomic flush/commit per batch
    - Asynchronously enqueues page embeddings
    """
    if not events:
        return 0, 0, []

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

    accepted = 0
    rejected = 0
    errors: list[str] = []

    # 1. Pre-load user excluded domains into a set (1 query)
    excluded_domains_set = await get_user_excluded_domains_set(db, user_id)

    # Filter out excluded domains and normalize URLs
    candidate_events: list[BrowsingEventPayload] = []
    for ev in events:
        if ev.domain in excluded_domains_set:
            rejected += 1
            continue
        candidate_events.append(ev)

    if not candidate_events:
        connection.last_synced_at = datetime.now(timezone.utc)
        return accepted, rejected, errors

    # 2. Bulk lookup & create Domains (1 query + bulk insert if missing)
    distinct_domain_names = {ev.domain for ev in candidate_events if ev.domain}
    existing_domains_res = await db.execute(
        select(Domain).where(Domain.domain_name.in_(distinct_domain_names))
    )
    domains_map = {d.domain_name: d for d in existing_domains_res.scalars().all()}

    new_domains = []
    for ev in candidate_events:
        if ev.domain and ev.domain not in domains_map:
            fav_url = ev.metadata.favicon_url if ev.metadata else None
            domain_obj = Domain(id=uuid.uuid4(), domain_name=ev.domain, favicon_url=fav_url)
            domains_map[ev.domain] = domain_obj
            new_domains.append(domain_obj)

    if new_domains:
        db.add_all(new_domains)
        await db.flush()

    # 3. Bulk lookup & create Pages (1 query + bulk insert if missing)
    distinct_urls = {ev.url for ev in candidate_events if ev.url}
    existing_pages_res = await db.execute(
        select(Page).where(Page.url.in_(distinct_urls))
    )
    pages_map = {p.url: p for p in existing_pages_res.scalars().all()}

    now = datetime.now(timezone.utc)
    new_pages = []
    for ev in candidate_events:
        if ev.url not in pages_map:
            domain_obj = domains_map.get(ev.domain)
            if not domain_obj:
                continue
            meta_dict = ev.metadata.model_dump() if ev.metadata else None
            page_obj = Page(
                id=uuid.uuid4(),
                url=ev.url,
                title=ev.title,
                domain_id=domain_obj.id,
                metadata=meta_dict,
                first_seen_at=now,
                last_seen_at=now,
            )
            pages_map[ev.url] = page_obj
            new_pages.append(page_obj)
        else:
            # Update last_seen_at on existing page
            p = pages_map[ev.url]
            p.last_seen_at = now
            if ev.title and ev.title != p.title:
                p.title = ev.title

    if new_pages:
        db.add_all(new_pages)
        await db.flush()

    # 4. Bulk deduplication check across time window (1 query)
    visited_times = [ev.visited_at for ev in candidate_events]
    min_time = min(visited_times) - timedelta(seconds=35)
    max_time = max(visited_times) + timedelta(seconds=35)
    page_ids = [p.id for p in pages_map.values()]

    existing_events_res = await db.execute(
        select(BrowsingEvent.page_id, BrowsingEvent.visited_at).where(
            and_(
                BrowsingEvent.user_id == user_id,
                BrowsingEvent.page_id.in_(page_ids),
                BrowsingEvent.visited_at >= min_time,
                BrowsingEvent.visited_at <= max_time,
            )
        )
    )
    existing_tuples = {
        (row[0], int(row[1].timestamp())) for row in existing_events_res.all()
    }

    # Track in-batch deduplication
    seen_in_batch: set[tuple[uuid.UUID, int]] = set()
    new_browsing_events: list[BrowsingEvent] = []
    new_search_queries: list[SearchQuery] = []
    pages_to_embed: set[uuid.UUID] = set()

    for event in candidate_events:
        page = pages_map.get(event.url)
        if not page:
            rejected += 1
            continue

        ts_sec = int(event.visited_at.timestamp())
        # Check window +/- 30 seconds
        is_dup = False
        for delta in range(-30, 31):
            if (page.id, ts_sec + delta) in existing_tuples or (page.id, ts_sec + delta) in seen_in_batch:
                is_dup = True
                break

        if is_dup:
            rejected += 1
            continue

        seen_in_batch.add((page.id, ts_sec))
        meta_dict = event.metadata.model_dump() if event.metadata else None

        be_id = uuid.uuid4()
        browsing_event = BrowsingEvent(
            id=be_id,
            user_id=user_id,
            browser_connection_id=connection_id,
            page_id=page.id,
            visited_at=event.visited_at,
            source_browser=event.source_browser,
            metadata=meta_dict,
        )
        new_browsing_events.append(browsing_event)
        pages_to_embed.add(page.id)

        # Search query extraction
        search_result = extract_search_query(event.url)
        if search_result:
            q_text, engine = search_result
            new_search_queries.append(
                SearchQuery(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    browsing_event_id=be_id,
                    query_text=q_text,
                    search_engine=engine,
                    searched_at=event.visited_at,
                )
            )
        elif event.metadata and event.metadata.search_query:
            new_search_queries.append(
                SearchQuery(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    browsing_event_id=be_id,
                    query_text=event.metadata.search_query,
                    search_engine=event.metadata.search_engine,
                    searched_at=event.visited_at,
                )
            )

        accepted += 1

    # Insert events and search queries in batch
    if new_browsing_events:
        db.add_all(new_browsing_events)
    if new_search_queries:
        db.add_all(new_search_queries)

    connection.last_synced_at = datetime.now(timezone.utc)
    await db.flush()

    # Enqueue embedding tasks asynchronously (non-blocking)
    for p_id in pages_to_embed:
        await enqueue_page_embedding(p_id)

    return accepted, rejected, errors
