"""
Recall API — Seed Data

Generates realistic demo browsing data with sessions and topics.
Run with: python -m app.seed
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.database import async_session, init_db
from app.models.models import (
    BrowserConnection,
    BrowsingEvent,
    BrowsingSession,
    Domain,
    MemoryTopic,
    Page,
    PageTopic,
    SearchQuery,
    User,
)
from app.services.auth_service import hash_password

# Realistic browsing data grouped into research sessions
SESSIONS_DATA = [
    {
        "topic": "AI Agents & Autonomous Systems",
        "color": "#6366f1",
        "hours_ago_start": 2.5,
        "hours_ago_end": 1.2,
        "items": [
            {"url": "https://www.google.com/search?q=ai+agents+framework", "title": "ai agents framework - Google Search", "domain": "www.google.com", "hours_ago": 2.5, "search_query": "ai agents framework", "search_engine": "google"},
            {"url": "https://github.com/langchain-ai/langchain", "title": "langchain-ai/langchain: Building applications with LLMs", "domain": "github.com", "hours_ago": 2.3},
            {"url": "https://docs.langchain.com/docs/get_started/introduction", "title": "Introduction | LangChain", "domain": "docs.langchain.com", "hours_ago": 2.1},
            {"url": "https://github.com/microsoft/autogen", "title": "microsoft/autogen: Multi-agent framework", "domain": "github.com", "hours_ago": 1.8},
            {"url": "https://arxiv.org/abs/2308.08155", "title": "AutoGen: Multi-Agent Conversation Framework", "domain": "arxiv.org", "hours_ago": 1.7},
            {"url": "https://www.youtube.com/watch?v=abc123", "title": "Building AI Agents from Scratch - Full Tutorial", "domain": "www.youtube.com", "hours_ago": 1.5},
            {"url": "https://www.reddit.com/r/MachineLearning/comments/abc/autogen_vs_langchain/", "title": "AutoGen vs LangChain for multi-agent systems : MachineLearning", "domain": "www.reddit.com", "hours_ago": 1.3},
        ],
    },
    {
        "topic": "CUDA & GPU Memory Optimization",
        "color": "#10b981",
        "hours_ago_start": 74.0,
        "hours_ago_end": 71.5,
        "items": [
            {"url": "https://www.google.com/search?q=cuda+memory+model+explained", "title": "cuda memory model explained - Google Search", "domain": "www.google.com", "hours_ago": 74.0, "search_query": "cuda memory model explained", "search_engine": "google"},
            {"url": "https://docs.nvidia.com/cuda/cuda-c-programming-guide/", "title": "CUDA C++ Programming Guide - NVIDIA Documentation", "domain": "docs.nvidia.com", "hours_ago": 73.8},
            {"url": "https://developer.nvidia.com/cuda-toolkit", "title": "CUDA Toolkit | NVIDIA Developer", "domain": "developer.nvidia.com", "hours_ago": 73.5},
            {"url": "https://stackoverflow.com/questions/12345/cuda-shared-memory-vs-global", "title": "CUDA shared memory vs global memory - Stack Overflow", "domain": "stackoverflow.com", "hours_ago": 73.0},
            {"url": "https://github.com/NVIDIA/cuda-samples", "title": "NVIDIA/cuda-samples: Samples for CUDA Developers", "domain": "github.com", "hours_ago": 72.5},
            {"url": "https://www.youtube.com/watch?v=def456", "title": "CUDA Programming Tutorial - Memory Management", "domain": "www.youtube.com", "hours_ago": 72.0},
        ],
    },
    {
        "topic": "Psychological Thriller Cinema",
        "color": "#ec4899",
        "hours_ago_start": 50.0,
        "hours_ago_end": 48.5,
        "items": [
            {"url": "https://www.google.com/search?q=best+psychological+thriller+movies", "title": "best psychological thriller movies - Google Search", "domain": "www.google.com", "hours_ago": 50.0, "search_query": "best psychological thriller movies", "search_engine": "google"},
            {"url": "https://www.imdb.com/title/tt4857264/", "title": "The Invisible Guest (2016) - IMDb", "domain": "www.imdb.com", "hours_ago": 49.8},
            {"url": "https://www.reddit.com/r/movies/comments/xyz/the_invisible_guest/", "title": "The Invisible Guest is an incredible thriller : movies", "domain": "www.reddit.com", "hours_ago": 49.5},
            {"url": "https://en.wikipedia.org/wiki/The_Invisible_Guest", "title": "The Invisible Guest - Wikipedia", "domain": "en.wikipedia.org", "hours_ago": 49.3},
            {"url": "https://www.imdb.com/title/tt1130884/", "title": "Shutter Island (2010) - IMDb", "domain": "www.imdb.com", "hours_ago": 49.0},
        ],
    },
    {
        "topic": "Spring Boot & Modern Java",
        "color": "#f59e0b",
        "hours_ago_start": 26.5,
        "hours_ago_end": 23.0,
        "items": [
            {"url": "https://www.google.com/search?q=spring+boot+best+practices+2026", "title": "spring boot best practices 2026 - Google Search", "domain": "www.google.com", "hours_ago": 26.0, "search_query": "spring boot best practices 2026", "search_engine": "google"},
            {"url": "https://spring.io/guides/gs/spring-boot", "title": "Getting Started | Building an Application with Spring Boot", "domain": "spring.io", "hours_ago": 25.9},
            {"url": "https://www.baeldung.com/spring-boot-best-practices", "title": "Spring Boot Best Practices | Baeldung", "domain": "www.baeldung.com", "hours_ago": 25.8},
            {"url": "https://leetcode.com/problems/two-sum/", "title": "Two Sum - LeetCode", "domain": "leetcode.com", "hours_ago": 24.0},
            {"url": "https://docs.oracle.com/en/java/javase/21/docs/api/", "title": "Java SE 21 & JDK 21 API Specification", "domain": "docs.oracle.com", "hours_ago": 23.5},
        ],
    },
    {
        "topic": "Frontend UI & React Ecosystem",
        "color": "#3b82f6",
        "hours_ago_start": 146.0,
        "hours_ago_end": 144.0,
        "items": [
            {"url": "https://react.dev/learn", "title": "Quick Start – React", "domain": "react.dev", "hours_ago": 146.0},
            {"url": "https://react.dev/reference/react/hooks", "title": "Built-in React Hooks – React", "domain": "react.dev", "hours_ago": 145.5},
            {"url": "https://www.youtube.com/watch?v=ghi789", "title": "React Server Components Explained", "domain": "www.youtube.com", "hours_ago": 145.0},
            {"url": "https://github.com/pmndrs/zustand", "title": "pmndrs/zustand: Bear necessities for state management in React", "domain": "github.com", "hours_ago": 144.5},
        ],
    },
]


async def seed_user_data(db, email, password, display_name):
    from sqlalchemy import select

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
        )
        db.add(user)
        await db.flush()

    # Create browser connection
    conn_result = await db.execute(select(BrowserConnection).where(BrowserConnection.user_id == user.id))
    connection = conn_result.scalar_one_or_none()
    if not connection:
        connection = BrowserConnection(
            user_id=user.id,
            browser_type="chrome",
            connection_name=f"{display_name}'s Primary Browser",
            auth_token_hash=hash_password("demo-token"),
            is_active=True,
            is_paused=False,
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(connection)
        await db.flush()

    now = datetime.now(timezone.utc)
    domain_cache: dict[str, Domain] = {}
    page_cache: dict[str, Page] = {}

    for s_data in SESSIONS_DATA:
        # Create Topic
        slug = s_data["topic"].lower().replace(" ", "-").replace("&", "and")
        topic_res = await db.execute(select(MemoryTopic).where(MemoryTopic.user_id == user.id, MemoryTopic.slug == slug))
        topic = topic_res.scalar_one_or_none()
        if not topic:
            topic = MemoryTopic(
                user_id=user.id,
                name=s_data["topic"],
                slug=slug,
                color=s_data["color"],
                is_auto_generated=True,
            )
            db.add(topic)
            await db.flush()

        # Create Session
        start_t = now - timedelta(hours=s_data["hours_ago_start"])
        end_t = now - timedelta(hours=s_data["hours_ago_end"])
        session = BrowsingSession(
            user_id=user.id,
            inferred_topic=s_data["topic"],
            started_at=start_t,
            ended_at=end_t,
        )
        db.add(session)
        await db.flush()

        for item in s_data["items"]:
            domain_name = item["domain"]
            if domain_name not in domain_cache:
                d_res = await db.execute(select(Domain).where(Domain.domain_name == domain_name))
                d_obj = d_res.scalar_one_or_none()
                if not d_obj:
                    d_obj = Domain(domain_name=domain_name)
                    db.add(d_obj)
                    await db.flush()
                domain_cache[domain_name] = d_obj
            domain = domain_cache[domain_name]

            url = item["url"]
            if url not in page_cache:
                visited_at = now - timedelta(hours=item["hours_ago"])
                p_res = await db.execute(select(Page).where(Page.url == url))
                p_obj = p_res.scalar_one_or_none()
                if not p_obj:
                    p_obj = Page(
                        url=url,
                        title=item["title"],
                        domain_id=domain.id,
                        first_seen_at=visited_at,
                        last_seen_at=visited_at,
                    )
                    db.add(p_obj)
                    await db.flush()

                    # Tag with topic
                    pt = PageTopic(page_id=p_obj.id, topic_id=topic.id, confidence=0.95)
                    db.add(pt)
                page_cache[url] = p_obj
            page = page_cache[url]

            # Add browsing event
            visited_at = now - timedelta(hours=item["hours_ago"])
            ev = BrowsingEvent(
                user_id=user.id,
                browser_connection_id=connection.id,
                page_id=page.id,
                session_id=session.id,
                visited_at=visited_at,
                source_browser="chrome",
                duration_seconds=120,
            )
            db.add(ev)
            await db.flush()

            if "search_query" in item:
                sq = SearchQuery(
                    user_id=user.id,
                    browsing_event_id=ev.id,
                    query_text=item["search_query"],
                    search_engine=item.get("search_engine", "google"),
                    searched_at=visited_at,
                )
                db.add(sq)

    await db.commit()


async def seed():
    """Seed the database with realistic demo data for testing."""
    await init_db()
    async with async_session() as db:
        # Seed both mohit@recall.dev and demo@recall.local
        await seed_user_data(db, "demo@recall.local", "demo_password", "Demo Explorer")
        await seed_user_data(db, "mohit@recall.dev", "password123", "Mohit")
        print("Database seeded with realistic multi-topic browsing history & research journeys!")


if __name__ == "__main__":
    asyncio.run(seed())
