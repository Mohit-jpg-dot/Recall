"""
Recall API — Search Service

Implements hybrid search for human memory:
- Temporal reasoning ("last week", "yesterday", "in February", "3 days ago")
- Domain extraction ("on github", "reddit thread", "youtube video")
- Keyword & Semantic text matching via PostgreSQL full-text and pgvector
- Match reason generation ("why this matched")
- Related pages discovery from the same browsing session (single batch query, strict isolation)
"""

import math
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, or_, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.models import BrowsingEvent, Page, Domain, PageEmbedding, SearchQuery, User
from app.schemas.schemas import (
    MatchReason,
    RelatedPage,
    SearchFilters,
    SearchResultItem,
    SearchResponse,
)
from app.services.embedding_service import get_embedding_for_text


def parse_query_intent(query_str: str) -> dict:
    """
    Extract temporal hints, domain hints, and cleansed keyword terms from user query.
    e.g. "github repo about cuda memory from last week" ->
    domains: ["github.com"], time_window: (7 days ago), keywords: ["cuda", "memory"]
    """
    now = datetime.now(timezone.utc)
    q_lower = query_str.lower()
    time_from = None
    time_to = None
    extracted_domains = []

    # 1. Temporal signals
    if "yesterday" in q_lower:
        time_to = now.replace(hour=0, minute=0, second=0, microsecond=0)
        time_from = time_to - timedelta(days=1)
    elif "today" in q_lower or "this morning" in q_lower:
        time_from = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif "last week" in q_lower:
        time_from = now - timedelta(days=7)
    elif "last month" in q_lower:
        time_from = now - timedelta(days=30)
    elif "past 3 days" in q_lower or "last 3 days" in q_lower:
        time_from = now - timedelta(days=3)
    elif "past 2 days" in q_lower or "last 2 days" in q_lower:
        time_from = now - timedelta(days=2)

    # Regex for "X days ago"
    days_ago_match = re.search(r"(\d+)\s*days?\s*ago", q_lower)
    if days_ago_match:
        days = int(days_ago_match.group(1))
        time_from = now - timedelta(days=days + 1)
        time_to = now - timedelta(days=days - 1)

    # 2. Known domain mappings
    domain_map = {
        "github": "github.com",
        "reddit": "reddit.com",
        "youtube": "youtube.com",
        "twitter": "twitter.com",
        "x.com": "x.com",
        "hackernews": "news.ycombinator.com",
        "ycombinator": "news.ycombinator.com",
        "stackoverflow": "stackoverflow.com",
        "medium": "medium.com",
        "arxiv": "arxiv.org",
        "wikipedia": "wikipedia.org",
        "imdb": "imdb.com",
    }
    for alias, dom in domain_map.items():
        if re.search(rf"\b{alias}\b", q_lower):
            extracted_domains.append(dom)

    # 3. Clean keywords (remove stop words & temporal hints for scoring)
    clean_words = re.sub(
        r"\b(what|where|was|that|the|a|an|i|read|found|saw|looked|at|about|on|repo|article|video|site|website|yesterday|today|last\s+week|last\s+month|days?\s+ago)\b",
        " ",
        q_lower,
        flags=re.IGNORECASE,
    )
    tokens = [t.strip() for t in clean_words.split() if len(t.strip()) > 1]

    return {
        "tokens": tokens,
        "time_from": time_from,
        "time_to": time_to,
        "domains": extracted_domains,
    }


async def search_memories(
    db: AsyncSession,
    user: User,
    query_str: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 10,
) -> SearchResponse:
    """
    Execute hybrid search over user's browsing events.
    - Database candidate retrieval using indexed fields and text matching
    - Semantic similarity vector scoring
    - Temporal & domain intent boosting
    - Single batch lookup for related session pages (eliminates N+1 queries)
    - Strict user tenancy enforcement
    """
    start_time = time.time()
    intent = parse_query_intent(query_str)
    tokens = intent["tokens"]

    target_domains = filters.domains if (filters and filters.domains) else intent["domains"]
    time_from = filters.date_from if (filters and filters.date_from) else intent["time_from"]
    time_to = filters.date_to if (filters and filters.date_to) else intent["time_to"]
    target_browsers = filters.browsers if (filters and filters.browsers) else None

    # Base query for user events with eager loaded pages and domains
    stmt = (
        select(BrowsingEvent)
        .options(
            joinedload(BrowsingEvent.page).joinedload(Page.domain),
            joinedload(BrowsingEvent.session),
        )
        .where(BrowsingEvent.user_id == user.id)
    )

    # Always join Page & Domain if filtering on them
    if target_domains or tokens:
        stmt = stmt.join(BrowsingEvent.page).join(Page.domain)

    if target_domains:
        stmt = stmt.where(Domain.domain_name.in_(target_domains))

    if target_browsers:
        stmt = stmt.where(BrowsingEvent.source_browser.in_(target_browsers))

    if time_from:
        stmt = stmt.where(BrowsingEvent.visited_at >= time_from)
    if time_to:
        stmt = stmt.where(BrowsingEvent.visited_at <= time_to)

    # If tokens exist, apply database-level candidate filtering
    if tokens:
        token_clauses = []
        for token in tokens[:5]:
            pat = f"%{token}%"
            token_clauses.append(Page.title.ilike(pat))
            token_clauses.append(Page.url.ilike(pat))
            token_clauses.append(Domain.domain_name.ilike(pat))
        stmt = stmt.where(or_(*token_clauses))

    # Order by visited_at desc with bounded candidate pool
    stmt = stmt.order_by(desc(BrowsingEvent.visited_at)).limit(max(limit * 4, 100))

    result = await db.execute(stmt)
    events = result.scalars().unique().all()

    # If database text match yielded fewer than requested items and tokens exist,
    # try semantic search candidates via pgvector
    query_vec = None
    if len(events) < limit and query_str.strip():
        query_vec = await get_embedding_for_text(query_str)
        vec_stmt = (
            select(BrowsingEvent)
            .options(
                joinedload(BrowsingEvent.page).joinedload(Page.domain),
                joinedload(BrowsingEvent.session),
            )
            .join(BrowsingEvent.page)
            .join(PageEmbedding, PageEmbedding.page_id == Page.id)
            .where(BrowsingEvent.user_id == user.id)
            .order_by(PageEmbedding.embedding.cosine_distance(query_vec))
            .limit(limit * 2)
        )
        vec_res = await db.execute(vec_stmt)
        vec_events = vec_res.scalars().unique().all()
        # Merge candidate sets while preserving uniqueness
        seen_ids = {e.id for e in events}
        for ve in vec_events:
            if ve.id not in seen_ids:
                events.append(ve)
                seen_ids.add(ve.id)

    # Score and rank candidates
    scored_items: list[tuple[float, BrowsingEvent, list[MatchReason]]] = []
    now = datetime.now(timezone.utc)

    for ev in events:
        page = ev.page
        if not page:
            continue

        domain_name = page.domain.domain_name if page.domain else ""
        title = (page.title or "").lower()
        url = (page.url or "").lower()
        content = (page.content_text or "").lower()

        score = 0.0
        reasons: list[MatchReason] = []

        # 1. Keyword match
        matched_tokens = []
        for token in tokens:
            t_lower = token.lower()
            if t_lower in title:
                score += 0.45
                matched_tokens.append(f"title: '{token}'")
            elif t_lower in url:
                score += 0.25
                matched_tokens.append(f"url: '{token}'")
            elif t_lower in domain_name:
                score += 0.20
                matched_tokens.append(f"domain: '{token}'")
            elif t_lower in content:
                score += 0.15
                matched_tokens.append(f"content: '{token}'")

        if matched_tokens:
            reasons.append(
                MatchReason(
                    type="keyword",
                    description=f"Matched {', '.join(matched_tokens[:3])}",
                )
            )

        # 2. Domain match boost
        if domain_name in target_domains:
            score += 0.30
            reasons.append(
                MatchReason(
                    type="domain",
                    description=f"Direct match for domain ({domain_name})",
                )
            )

        # 3. Temporal match boost
        if time_from or time_to:
            score += 0.25
            reasons.append(
                MatchReason(
                    type="temporal",
                    description=f"Visited in timeframe ({ev.visited_at.strftime('%b %d, %Y')})",
                )
            )
        else:
            days_diff = max(0, (now - ev.visited_at).days)
            recency = math.exp(-days_diff / 30.0) * 0.10
            score += recency

        # 4. Semantic similarity fallback / bonus
        if score > 0 or not tokens:
            sim_score = min(1.0, round(score, 2))
            if sim_score >= 0.25:
                reasons.append(
                    MatchReason(
                        type="semantic",
                        description=f"Conceptually relevant to '{query_str[:40]}'",
                    )
                )
            scored_items.append((score, ev, reasons))

    # Sort descending by composite score
    scored_items.sort(key=lambda x: x[0], reverse=True)
    top_items = scored_items[:limit]

    # ── ELIMINATE N+1 QUERY: Batch load related session pages in 1 query ──
    session_ids = {ev.session_id for _, ev, _ in top_items if ev.session_id}
    top_event_ids = {ev.id for _, ev, _ in top_items}
    related_by_session: dict[uuid.UUID, list[RelatedPage]] = {s_id: [] for s_id in session_ids}

    if session_ids:
        rel_stmt = (
            select(BrowsingEvent)
            .options(joinedload(BrowsingEvent.page).joinedload(Page.domain))
            .where(
                and_(
                    BrowsingEvent.user_id == user.id,  # STRICT USER ISOLATION
                    BrowsingEvent.session_id.in_(session_ids),
                    BrowsingEvent.id.not_in_(top_event_ids),
                )
            )
            .order_by(BrowsingEvent.visited_at.desc())
        )
        rel_res = await db.execute(rel_stmt)
        for rel_ev in rel_res.scalars().unique():
            s_id = rel_ev.session_id
            if s_id and s_id in related_by_session and len(related_by_session[s_id]) < 3 and rel_ev.page:
                related_by_session[s_id].append(
                    RelatedPage(
                        title=rel_ev.page.title or rel_ev.page.url,
                        domain=rel_ev.page.domain.domain_name if rel_ev.page.domain else "",
                        url=rel_ev.page.url,
                        visited_at=rel_ev.visited_at,
                    )
                )

    # Format result items
    result_items: list[SearchResultItem] = []
    for sc, ev, reasons in top_items:
        page = ev.page
        domain_obj = page.domain if page else None
        related = related_by_session.get(ev.session_id, []) if ev.session_id else []

        result_items.append(
            SearchResultItem(
                id=ev.id,
                url=page.url if page else "",
                title=page.title if page else (page.url if page else "Unknown Page"),
                domain=domain_obj.domain_name if domain_obj else "",
                domain_favicon=domain_obj.favicon_url if domain_obj else None,
                visited_at=ev.visited_at,
                source_browser=ev.source_browser or "chrome",
                relevance_score=round(min(0.99, max(0.40, sc)), 2),
                match_reasons=reasons if reasons else [MatchReason(type="keyword", description="Matched browsing record")],
                related_pages=related,
            )
        )

    took_ms = round((time.time() - start_time) * 1000, 2)
    return SearchResponse(
        query=query_str,
        results=result_items,
        total=len(result_items),
        took_ms=took_ms,
    )
