"""
Recall API — Search Service

Implements hybrid search for human memory:
- Temporal reasoning ("last week", "yesterday", "today", "3 days ago")
- Domain extraction ("on github", "reddit thread", "youtube video")
- Semantic category intelligence (games, songs/music, movies, code)
- SearchQuery integration (Google, YouTube search intents)
- URL deduplication & homepage specificity weighting
- Meaningful match reasons and strict score thresholding
"""

import math
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse, parse_qs, urlunparse


def normalize_url(url: str) -> str:
    """Normalize URLs for deduplication across tracking params, hash fragments, and search params."""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        if "google.com" in parsed.netloc and parsed.path == "/search":
            qs = parse_qs(parsed.query)
            q_val = qs.get("q", [""])[0]
            return f"https://www.google.com/search?q={q_val.lower().strip()}"
        if "youtube.com" in parsed.netloc and "results" in parsed.path:
            qs = parse_qs(parsed.query)
            sq_val = qs.get("search_query", [""])[0]
            return f"https://www.youtube.com/results?search_query={sq_val.lower().strip()}"
        if "youtube.com" in parsed.netloc and "watch" in parsed.path:
            qs = parse_qs(parsed.query)
            v_val = qs.get("v", [""])[0]
            return f"https://www.youtube.com/watch?v={v_val}"
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
    except Exception:
        return url.split("#")[0]

from sqlalchemy import select, or_, and_, desc
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

# ── Semantic Knowledge Dictionaries ──────────────────────────────────────────

KNOWN_GAMES = {
    "hollow knight", "gta", "gta 6", "grand theft auto", "minecraft", "roblox",
    "elden ring", "zelda", "witcher", "cyberpunk", "silksong", "valorant",
    "fortnite", "counter strike", "csgo", "steam", "dota", "league of legends",
    "apex legends", "overwatch", "skyrim", "fallout", "pokemon", "mario",
    "dark souls", "bloodborne", "sekiro", "god of war", "red dead", "rdr2",
}

KNOWN_MUSIC_TERMS = [
    "song", "songs", "music", "track", "tracks", "audio", "soundtrack", "ost",
    "album", "lyrics", "amv", "mv", "tombstone", "survivor", "ordinary life",
    "singer", "artist", "living tombstone", "playlist", "remix", "beats",
    "melody", "spotify", "soundcloud", "bandcamp", "apple music", "lofi",
]

KNOWN_MOVIE_TERMS = [
    "movie", "movies", "film", "films", "cinema", "trailer", "trailers",
    "explained in hindi", "phir hera pheri", "yellow eyes", "underrated movie",
    "imdb", "netflix", "actor", "director", "series", "season", "episode",
    "rotten tomatoes", "box office", "web series",
]


def classify_content(title: str, url: str, query_text: str = "") -> set[str]:
    """Classify page or search query content into semantic categories (song, game, movie, code)."""
    t_lower = (title or "").lower()
    u_lower = (url or "").lower()
    q_lower = (query_text or "").lower()
    combined = f"{t_lower} {u_lower} {q_lower}"

    categories = set()

    # 1. Movie check (prioritize to avoid collision with generic video terms)
    for m in KNOWN_MOVIE_TERMS:
        if re.search(r"\b" + re.escape(m) + r"\b", combined):
            categories.add("movie")
            break

    # 2. Game check
    for g in KNOWN_GAMES:
        if re.search(r"\b" + re.escape(g) + r"\b", combined):
            categories.add("game")
            break
    if not categories and any(w in combined for w in ["gameplay", "walkthrough", "game leaks", "pc game", "video game"]):
        categories.add("game")

    # 3. Music / Song check
    # Avoid classifying movie videos as songs
    if "movie" not in categories:
        for m in KNOWN_MUSIC_TERMS:
            if re.search(r"\b" + re.escape(m) + r"\b", combined):
                categories.add("song")
                break
        if "song" not in categories and "youtube.com/watch" in u_lower:
            if any(re.search(r"\b" + re.escape(w) + r"\b", t_lower) for w in ["amv", "mv", "survivor", "ordinary life"]):
                categories.add("song")

    # 4. Code / Programming check
    if any(c in combined for c in ["chai aur code", "github.com", "stackoverflow.com", "python", "react", "fastapi", "docker"]):
        categories.add("code")

    return categories


def parse_query_intent(query_str: str) -> dict:
    """
    Extract temporal hints, domain hints, category intent, search intent, and clean search tokens.
    """
    now = datetime.now(timezone.utc)
    q_lower = query_str.lower().strip()
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
        "google": "google.com",
        "chatgpt": "chatgpt.com",
    }
    for alias, dom in domain_map.items():
        if re.search(rf"\b{alias}\b", q_lower):
            extracted_domains.append(dom)

    # 3. Detect Category Intent
    target_category = None
    if any(re.search(rf"\b{w}\b", q_lower) for w in ["song", "songs", "music", "track", "tracks", "audio", "soundtrack", "ost", "album", "lyrics", "listen"]):
        target_category = "song"
    elif any(re.search(rf"\b{w}\b", q_lower) for w in ["game", "games", "gaming", "gamer", "played", "play", "gameplay", "video game"]):
        target_category = "game"
    elif any(re.search(rf"\b{w}\b", q_lower) for w in ["movie", "movies", "film", "films", "cinema", "trailer", "trailers", "show", "series"]):
        target_category = "movie"
    elif any(re.search(rf"\b{w}\b", q_lower) for w in ["code", "coding", "programming", "repo", "repository", "developer"]):
        target_category = "code"

    # 4. Search activity intent ("i searched", "search for")
    is_search_intent = bool(re.search(r"\b(searched|search|googled|query|looked\s+up|looking\s+for|find|found)\b", q_lower))

    # 5. Clean keywords (remove conversational boilerplate and domain names that are filters)
    stop_pattern = (
        r"\b(what|where|was|that|the|a|an|i|read|found|saw|looked|looking|at|about|on|repo|article|video|"
        r"site|website|yesterday|today|last\s+week|last\s+month|days?\s+ago|search|searched|some|any|"
        r"have|tell|me|show|give|did|which|for|of|in|to|with|and|or|is|are|it|my|by)\b"
    )
    clean_words = re.sub(stop_pattern, " ", q_lower, flags=re.IGNORECASE)

    # Remove domain keywords from search tokens if they're used as domain filters
    for alias in domain_map:
        clean_words = re.sub(rf"\b{alias}\b", " ", clean_words, flags=re.IGNORECASE)

    # If the user searched a pure category word like "song" or "game", don't require literal keyword match
    for cat_word in ["song", "songs", "music", "game", "games", "movie", "movies", "film", "code"]:
        clean_words = re.sub(rf"\b{cat_word}\b", " ", clean_words, flags=re.IGNORECASE)

    tokens = [t.strip() for t in clean_words.split() if len(t.strip()) > 1]

    return {
        "tokens": tokens,
        "time_from": time_from,
        "time_to": time_to,
        "domains": extracted_domains,
        "target_category": target_category,
        "is_search_intent": is_search_intent,
    }


async def search_memories(
    db: AsyncSession,
    user: User,
    query_str: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 10,
) -> SearchResponse:
    """
    Execute hybrid search with category intelligence, URL deduplication,
    SearchQuery awareness, and strict confidence filtering.
    """
    start_time = time.time()
    intent = parse_query_intent(query_str)
    tokens = intent["tokens"]
    target_category = intent["target_category"]
    is_search_intent = intent["is_search_intent"]

    target_domains = filters.domains if (filters and filters.domains) else intent["domains"]
    time_from = filters.date_from if (filters and filters.date_from) else intent["time_from"]
    time_to = filters.date_to if (filters and filters.date_to) else intent["time_to"]
    target_browsers = filters.browsers if (filters and filters.browsers) else None

    # Base query for user events with eager loaded pages, domains, and search queries
    stmt = (
        select(BrowsingEvent)
        .options(
            joinedload(BrowsingEvent.page).joinedload(Page.domain),
            joinedload(BrowsingEvent.session),
            joinedload(BrowsingEvent.search_query),
        )
        .join(BrowsingEvent.page)
        .join(Page.domain)
        .outerjoin(SearchQuery, SearchQuery.browsing_event_id == BrowsingEvent.id)
        .where(BrowsingEvent.user_id == user.id)
    )

    if target_domains:
        domain_clauses = []
        for dom in target_domains:
            clean_dom = dom.replace("www.", "")
            domain_clauses.append(Domain.domain_name == clean_dom)
            domain_clauses.append(Domain.domain_name == f"www.{clean_dom}")
            domain_clauses.append(Domain.domain_name.ilike(f"%{clean_dom}%"))
        stmt = stmt.where(or_(*domain_clauses))

    if target_browsers:
        stmt = stmt.where(BrowsingEvent.source_browser.in_(target_browsers))

    if time_from:
        stmt = stmt.where(BrowsingEvent.visited_at >= time_from)
    if time_to:
        stmt = stmt.where(BrowsingEvent.visited_at <= time_to)

    # Candidate text matching clauses
    candidate_clauses = []
    if tokens:
        for token in tokens[:5]:
            pat = f"%{token}%"
            candidate_clauses.append(Page.title.ilike(pat))
            candidate_clauses.append(Page.url.ilike(pat))
            candidate_clauses.append(SearchQuery.query_text.ilike(pat))

    # Category candidate expansion
    if target_category == "song":
        candidate_clauses.append(Domain.domain_name.ilike("%youtube.com%"))
        candidate_clauses.append(Domain.domain_name.ilike("%spotify.com%"))
        for term in ["song", "music", "track", "amv", "mv", "soundtrack", "ost", "lyrics", "living tombstone", "survivor", "ordinary life"]:
            candidate_clauses.append(Page.title.ilike(f"%{term}%"))
            candidate_clauses.append(SearchQuery.query_text.ilike(f"%{term}%"))
    elif target_category == "game":
        for g in ["hollow knight", "gta", "minecraft", "roblox", "game", "gaming", "steam"]:
            candidate_clauses.append(Page.title.ilike(f"%{g}%"))
            candidate_clauses.append(SearchQuery.query_text.ilike(f"%{g}%"))
    elif target_category == "movie":
        for m in ["movie", "film", "cinema", "phir hera pheri", "trailer", "explained in hindi"]:
            candidate_clauses.append(Page.title.ilike(f"%{m}%"))
            candidate_clauses.append(SearchQuery.query_text.ilike(f"%{m}%"))

    if candidate_clauses:
        stmt = stmt.where(or_(*candidate_clauses))

    # Retrieve candidate events
    stmt = stmt.order_by(desc(BrowsingEvent.visited_at)).limit(max(limit * 8, 120))
    result = await db.execute(stmt)
    events = list(result.scalars().unique().all())

    # Fallback to general recent events if filters yielded very few results
    if len(events) < limit and not target_domains and not tokens:
        fallback_stmt = (
            select(BrowsingEvent)
            .options(
                joinedload(BrowsingEvent.page).joinedload(Page.domain),
                joinedload(BrowsingEvent.session),
                joinedload(BrowsingEvent.search_query),
            )
            .join(BrowsingEvent.page)
            .where(BrowsingEvent.user_id == user.id)
            .order_by(desc(BrowsingEvent.visited_at))
            .limit(limit * 3)
        )
        fb_res = await db.execute(fallback_stmt)
        for ev in fb_res.scalars().unique().all():
            if ev.id not in {e.id for e in events}:
                events.append(ev)

    # ── DEDUPLICATE EVENTS BY NORMALIZED URL (Keep newest visit per distinct page) ──
    unique_key_events: dict[str, BrowsingEvent] = {}
    for ev in events:
        if not ev.page:
            continue
        key = normalize_url(ev.page.url or "") or str(ev.page_id)
        if key not in unique_key_events or ev.visited_at > unique_key_events[key].visited_at:
            unique_key_events[key] = ev

    deduped_events = list(unique_key_events.values())

    # ── SCORE AND RANK CANDIDATES ────────────────────────────────────────────
    scored_items: list[tuple[float, BrowsingEvent, list[MatchReason]]] = []
    now = datetime.now(timezone.utc)

    for ev in deduped_events:
        page = ev.page
        domain_name = page.domain.domain_name if page.domain else ""
        title = page.title or ""
        url = page.url or ""
        sq_text = ev.search_query.query_text if ev.search_query else ""
        t_lower = title.lower()
        u_lower = url.lower()
        sq_lower = sq_text.lower()

        score = 0.0
        reasons: list[MatchReason] = []

        # Detect semantic categories for this page
        cats = classify_content(title, url, sq_text)

        # 1. Root Homepage Penalty vs. Specific Page Bonus
        parsed = urlparse(url)
        is_root_page = parsed.path in ("", "/") and not parsed.query
        if is_root_page:
            score -= 0.60  # Root domain (e.g. https://www.youtube.com/) penalty
        else:
            if "/watch" in parsed.path or sq_text or "/search" in parsed.path:
                score += 0.20  # Deep content specificity bonus

        # 2. Category Intelligence Scoring
        if target_category:
            if target_category in cats:
                score += 0.85
                cat_desc = {
                    "song": "Matched music / song track",
                    "game": "Matched video game record",
                    "movie": "Matched movie / film record",
                    "code": "Matched coding / developer resource",
                }.get(target_category, f"Matched {target_category}")
                reasons.append(MatchReason(type="semantic", description=cat_desc))
            else:
                # Strong penalty if page does not match requested category
                score -= 0.85

        # 3. Direct Keyword & Search Query Matches
        matched_tokens = []
        for token in tokens:
            t_tok = token.lower()
            if sq_lower and t_tok in sq_lower:
                score += 0.65
                matched_tokens.append(f"search: '{token}'")
            if t_tok in t_lower:
                score += 0.45
                matched_tokens.append(f"title: '{token}'")
            elif t_tok in u_lower:
                score += 0.25
                matched_tokens.append(f"url: '{token}'")

        if matched_tokens:
            reasons.append(
                MatchReason(
                    type="keyword",
                    description=f"Matched {', '.join(matched_tokens[:3])}",
                )
            )

        # 4. Search Activity Intent Boost
        if is_search_intent and (sq_text or "search" in u_lower):
            score += 0.35
            engine_name = ev.search_query.search_engine.capitalize() if ev.search_query and ev.search_query.search_engine else "Web"
            reasons.append(
                MatchReason(
                    type="domain",
                    description=f"Your {engine_name} search for: '{sq_text or title[:30]}'",
                )
            )

        # 5. Domain Match Boost
        if target_domains and any(td in domain_name for td in target_domains):
            score += 0.30
            reasons.append(
                MatchReason(
                    type="domain",
                    description=f"Direct match for domain ({domain_name})",
                )
            )

        # 6. Temporal Match Boost
        if time_from or time_to:
            if time_from and ev.visited_at >= time_from:
                score += 0.25
                reasons.append(
                    MatchReason(
                        type="temporal",
                        description=f"Visited in timeframe ({ev.visited_at.strftime('%b %d, %Y')})",
                    )
                )
            else:
                score -= 0.40
        else:
            days_diff = max(0, (now - ev.visited_at).days)
            recency = math.exp(-days_diff / 30.0) * 0.10
            score += recency

        # 7. Strict Quality Threshold
        # Drop items that have zero keyword match and zero category match
        if score >= 0.25:
            # If reasons is empty, do not fabricate fake reasons
            if not reasons:
                reasons.append(MatchReason(type="temporal", description=f"Visited {ev.visited_at.strftime('%b %d')}"))
            scored_items.append((score, ev, reasons))

    # Sort descending by composite score
    scored_items.sort(key=lambda x: x[0], reverse=True)
    top_items = scored_items[:limit]

    # ── BATCH LOAD RELATED SESSION PAGES ─────────────────────────────────────
    session_ids = {ev.session_id for _, ev, _ in top_items if ev.session_id}
    top_event_ids = {ev.id for _, ev, _ in top_items}
    related_by_session: dict[uuid.UUID, list[RelatedPage]] = {s_id: [] for s_id in session_ids}

    if session_ids:
        rel_stmt = (
            select(BrowsingEvent)
            .options(joinedload(BrowsingEvent.page).joinedload(Page.domain))
            .where(
                and_(
                    BrowsingEvent.user_id == user.id,
                    BrowsingEvent.session_id.in_(session_ids),
                    BrowsingEvent.id.not_in(top_event_ids),
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

    # Format result items with truthful relevance scores
    result_items: list[SearchResultItem] = []
    for sc, ev, reasons in top_items:
        page = ev.page
        domain_obj = page.domain if page else None
        related = related_by_session.get(ev.session_id, []) if ev.session_id else []

        # If it was an actual search query with a generic title, make title readable
        display_title = page.title if page else "Unknown Page"
        if ev.search_query and "search_query=" in (page.url or "") and "results" in (page.url or ""):
            display_title = f"YouTube Search: \"{ev.search_query.query_text}\""

        # Normalize score into clean 0.25 - 0.99 range
        normalized_score = round(min(0.99, max(0.25, sc / 2.0 if sc > 2.0 else sc)), 2)

        result_items.append(
            SearchResultItem(
                id=ev.id,
                url=page.url if page else "",
                title=display_title,
                domain=domain_obj.domain_name if domain_obj else "",
                domain_favicon=domain_obj.favicon_url if domain_obj else None,
                visited_at=ev.visited_at,
                source_browser=ev.source_browser or "chrome",
                relevance_score=normalized_score,
                match_reasons=reasons,
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

