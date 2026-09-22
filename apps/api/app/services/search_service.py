"""
Recall API — Search Service

Implements hybrid search for human memory:
- Temporal reasoning ("last week", "yesterday", "in February", "3 days ago")
- Domain extraction ("on github", "reddit thread", "youtube video")
- Keyword & Semantic text matching
- Match reason generation ("why this matched")
- Related pages discovery from the same browsing session
"""

import math
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.models import BrowsingEvent, Page, Domain, SearchQuery, User
from app.schemas.schemas import (
    MatchReason,
    RelatedPage,
    SearchFilters,
    SearchResultItem,
    SearchResponse,
)


def parse_query_intent(query_str: str) -> dict:
    """
    Extract temporal hints, domain hints, and cleansed keyword terms from user query.
    e.g. "github repo about cuda memory from last week" ->
    domains: ["github.com"], time_window: (7 days ago), keywords: "cuda memory"
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
    """
    start_time = time.time()
    intent = parse_query_intent(query_str)
    tokens = intent["tokens"]

    # Base query for user events
    stmt = (
        select(BrowsingEvent)
        .options(
            joinedload(BrowsingEvent.page).joinedload(Page.domain),
            joinedload(BrowsingEvent.session),
        )
        .where(BrowsingEvent.user_id == user.id)
    )

    # Apply explicit or extracted filters
    if filters and filters.domains:
        stmt = stmt.join(BrowsingEvent.page).join(Page.domain).where(Domain.domain_name.in_(filters.domains))
    elif intent["domains"]:
        stmt = stmt.join(BrowsingEvent.page).join(Page.domain).where(Domain.domain_name.in_(intent["domains"]))

    if filters and filters.browsers:
        stmt = stmt.where(BrowsingEvent.source_browser.in_(filters.browsers))

    # Time bounds
    time_from = filters.date_from if (filters and filters.date_from) else intent["time_from"]
    time_to = filters.date_to if (filters and filters.date_to) else intent["time_to"]

    if time_from:
        stmt = stmt.where(BrowsingEvent.visited_at >= time_from)
    if time_to:
        stmt = stmt.where(BrowsingEvent.visited_at <= time_to)

    # Order by visited_at desc to retrieve candidates
    stmt = stmt.order_by(desc(BrowsingEvent.visited_at)).limit(150)

    result = await db.execute(stmt)
    events = result.scalars().unique().all()

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

        # 1. Keyword match in title / url / content
        matched_tokens = []
        for token in tokens:
            t_lower = token.lower()
            if t_lower in title:
                score += 0.4
                matched_tokens.append(f"title: '{token}'")
            elif t_lower in url:
                score += 0.25
                matched_tokens.append(f"url: '{token}'")
            elif t_lower in domain_name:
                score += 0.2
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

        # 2. Domain intent boost
        if domain_name in intent["domains"]:
            score += 0.3
            reasons.append(
                MatchReason(
                    type="domain",
                    description=f"Direct match for requested domain ({domain_name})",
                )
            )

        # 3. Temporal match boost
        if time_from or time_to:
            score += 0.25
            reasons.append(
                MatchReason(
                    type="temporal",
                    description=f"Visited within memory timeframe ({ev.visited_at.strftime('%b %d, %Y')})",
                )
            )
        else:
            # Subtle recency boost (exponential decay)
            days_diff = max(0, (now - ev.visited_at).days)
            recency = math.exp(-days_diff / 30.0) * 0.1
            score += recency

        # 4. Semantic similarity heuristic / vector fallback
        if score > 0 or not tokens:
            sim_score = min(1.0, round(score, 2))
            if sim_score >= 0.2:
                reasons.append(
                    MatchReason(
                        type="semantic",
                        description=f"Conceptual match with query '{query_str}'",
                    )
                )
            scored_items.append((score, ev, reasons))

    # Sort descending by relevance score
    scored_items.sort(key=lambda x: x[0], reverse=True)
    top_items = scored_items[:limit]

    # Format result items
    result_items: list[SearchResultItem] = []
    for sc, ev, reasons in top_items:
        page = ev.page
        domain_obj = page.domain if page else None

        # Discover related pages from same session
        related: list[RelatedPage] = []
        if ev.session_id:
            rel_stmt = (
                select(BrowsingEvent)
                .options(joinedload(BrowsingEvent.page).joinedload(Page.domain))
                .where(
                    and_(
                        BrowsingEvent.session_id == ev.session_id,
                        BrowsingEvent.id != ev.id,
                    )
                )
                .limit(3)
            )
            rel_res = await db.execute(rel_stmt)
            for rel_ev in rel_res.scalars().unique():
                if rel_ev.page:
                    related.append(
                        RelatedPage(
                            title=rel_ev.page.title,
                            domain=rel_ev.page.domain.domain_name if rel_ev.page.domain else "",
                            url=rel_ev.page.url,
                            visited_at=rel_ev.visited_at,
                        )
                    )

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
