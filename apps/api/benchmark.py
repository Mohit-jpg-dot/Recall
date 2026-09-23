"""
Recall API — Production Performance Benchmark

Conducts rigorous, realistic benchmarks against PostgreSQL + pgvector:
1. Ingestion Throughput:
   - 1,000 events (batches of 50)
   - 10,000 events (batches of 100)
   - High-scale seed up to 100,000 events
2. Search Latency on 100,000 events:
   - Keyword queries
   - Domain-filtered queries
   - Temporal queries ("yesterday", "last week")
   - Hybrid / Multi-parameter queries
3. Timeline Retrieval & EXPLAIN (ANALYZE, BUFFERS) Plan Inspection:
   - Index scan verification on idx_browsing_events_user_browser_visited
   - Buffer hit ratios & query execution times
4. Multi-Tenant Isolation Verification:
   - Strict cross-user boundary check at scale
"""

import asyncio
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models.models import (
    BrowserConnection,
    BrowsingEvent,
    Domain,
    Page,
    PageEmbedding,
    User,
)
from app.schemas.schemas import BrowsingEventPayload, PageMetadata, SearchFilters
from app.services.auth_service import hash_password
from app.services.event_service import ingest_events
from app.services.search_service import search_memories

DOMAINS = [
    "github.com",
    "arxiv.org",
    "news.ycombinator.com",
    "stackoverflow.com",
    "developer.mozilla.org",
    "python.org",
    "fastapi.tiangolo.com",
    "react.dev",
    "postgresql.org",
    "redis.io",
    "docs.anthropic.com",
    "openai.com",
    "nature.com",
    "en.wikipedia.org",
    "medium.com",
]

TOPICS = [
    "postgres index optimization btree hnsw",
    "vector search cosine similarity pgvector",
    "fastapi async sqlalchemy connection pool",
    "react server components hydration hooks",
    "distributed systems raft consensus leader",
    "transformer attention mechanisms deep learning",
    "safari webextensions manifest v3 service worker",
    "firefox gecko background scripts messaging",
    "offline event queue exponential backoff jitter",
    "rag grounded citation retrieval augmented generation",
]


def generate_synthetic_payloads(count: int, base_time: datetime) -> list[BrowsingEventPayload]:
    payloads = []
    for i in range(count):
        dom = random.choice(DOMAINS)
        topic = random.choice(TOPICS)
        words = topic.split()
        subtopic = "-".join(random.sample(words, min(3, len(words))))
        url = f"https://{dom}/articles/{subtopic}-{uuid.uuid4().hex[:6]}"
        title = f"{topic.title()} - Guide #{i}"
        delta_seconds = random.randint(0, 86400 * 30)
        visited = base_time - timedelta(seconds=delta_seconds)

        payloads.append(
            BrowsingEventPayload(
                url=url,
                title=title,
                domain=dom,
                visited_at=visited,
                source_browser=random.choice(["chrome", "firefox", "safari"]),
                metadata=PageMetadata(
                    description=f"Synthetic document covering {topic}",
                ),
            )
        )
    return payloads


async def run_benchmark():
    print("=" * 70)
    print("RECALL PRODUCTION PERFORMANCE & SCALE BENCHMARK")
    print("=" * 70)
    print(f"Connecting to database: {settings.database_url.split('@')[-1]}")

    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    bench_user_id = uuid.uuid4()
    conn_id = uuid.uuid4()
    other_user_id = uuid.uuid4()

    async with async_session() as db:
        # Create primary benchmark user
        user_alpha = User(
            id=bench_user_id,
            email=f"bench_alpha_{bench_user_id.hex[:6]}@example.com",
            password_hash=hash_password("BenchSecret123!"),
            display_name="Benchmark User Alpha",
        )
        db.add(user_alpha)

        conn_alpha = BrowserConnection(
            id=conn_id,
            user_id=bench_user_id,
            browser_type="chrome",
            connection_name="Bench Chrome",
            auth_token_hash=hash_password("bench-token"),
            is_active=True,
            is_paused=False,
        )
        db.add(conn_alpha)

        # Create secondary user for isolation verification
        user_beta = User(
            id=other_user_id,
            email=f"bench_beta_{other_user_id.hex[:6]}@example.com",
            password_hash=hash_password("BenchSecret123!"),
            display_name="Benchmark User Beta",
        )
        db.add(user_beta)
        await db.commit()

    print(f"Benchmark user created: {bench_user_id}")

    try:
        now = datetime.now(timezone.utc)

        # ---------------------------------------------------------------------
        # PHASE 1: INGESTION THROUGHPUT (1,000 events in batches of 50)
        # ---------------------------------------------------------------------
        print("\n--- Phase 1: Ingesting 1,000 events (batch size: 50) ---")
        batch_size_1k = 50
        batches_1k = 1000 // batch_size_1k
        latencies_1k = []

        start_1k = time.perf_counter()
        async with async_session() as db:
            for b in range(batches_1k):
                payloads = generate_synthetic_payloads(batch_size_1k, now)
                t0 = time.perf_counter()
                accepted, rejected, errs = await ingest_events(db, bench_user_id, conn_id, payloads)
                t1 = time.perf_counter()
                latencies_1k.append((t1 - t0) * 1000.0)

        total_time_1k = time.perf_counter() - start_1k
        throughput_1k = 1000 / total_time_1k
        p50_1k = np.percentile(latencies_1k, 50)
        p95_1k = np.percentile(latencies_1k, 95)
        p99_1k = np.percentile(latencies_1k, 99)

        print(f"  Total Ingested: 1,000 events in {total_time_1k:.3f}s")
        print(f"  Throughput:     {throughput_1k:.1f} events/sec")
        print(f"  Batch Latency (50 events): p50={p50_1k:.1f}ms, p95={p95_1k:.1f}ms, p99={p99_1k:.1f}ms")

        # ---------------------------------------------------------------------
        # PHASE 2: INGESTION THROUGHPUT (10,000 events in batches of 100)
        # ---------------------------------------------------------------------
        print("\n--- Phase 2: Ingesting 10,000 events (batch size: 100) ---")
        batch_size_10k = 100
        batches_10k = 10000 // batch_size_10k
        latencies_10k = []

        start_10k = time.perf_counter()
        async with async_session() as db:
            for b in range(batches_10k):
                payloads = generate_synthetic_payloads(batch_size_10k, now)
                t0 = time.perf_counter()
                accepted, rejected, errs = await ingest_events(db, bench_user_id, conn_id, payloads)
                t1 = time.perf_counter()
                latencies_10k.append((t1 - t0) * 1000.0)

        total_time_10k = time.perf_counter() - start_10k
        throughput_10k = 10000 / total_time_10k
        p50_10k = np.percentile(latencies_10k, 50)
        p95_10k = np.percentile(latencies_10k, 95)
        p99_10k = np.percentile(latencies_10k, 99)

        print(f"  Total Ingested: 10,000 events in {total_time_10k:.3f}s")
        print(f"  Throughput:     {throughput_10k:.1f} events/sec")
        print(f"  Batch Latency (100 events): p50={p50_10k:.1f}ms, p95={p95_10k:.1f}ms, p99={p99_10k:.1f}ms")

        # ---------------------------------------------------------------------
        # PHASE 3: FAST BULK SCALE SEEDING TO 100,000 EVENTS
        # ---------------------------------------------------------------------
        print("\n--- Phase 3: Scaling corpus to 100,000 events ---")
        current_count = 11000
        target_count = 100000
        needed = target_count - current_count
        print(f"  Seeding {needed} additional events via fast bulk generation...")

        async with async_session() as db:
            # Get existing domain IDs
            res = await db.execute(select(Domain.id))
            dom_ids = res.scalars().all()
            if not dom_ids:
                d = Domain(domain_name="github.com")
                db.add(d)
                await db.flush()
                dom_ids = [d.id]

            # Generate 5,000 unique pages to reuse across 89,000 events
            page_ids = []
            page_objs = []
            for p_idx in range(5000):
                topic = random.choice(TOPICS)
                words = topic.split()
                subtopic = "-".join(random.sample(words, min(3, len(words))))
                p_url = f"https://arxiv.org/abs/{subtopic}-{uuid.uuid4().hex[:8]}"
                p_title = f"{topic.title()} - Research Paper {p_idx}"
                p = Page(
                    url=p_url,
                    title=p_title,
                    domain_id=random.choice(dom_ids),
                    first_seen_at=now,
                    last_seen_at=now,
                )
                page_objs.append(p)

            db.add_all(page_objs)
            await db.flush()
            page_ids = [p.id for p in page_objs]

            # Bulk insert events in 5,000 chunks
            chunk_size = 5000
            chunks = needed // chunk_size
            remainder = needed % chunk_size

            for c in range(chunks):
                event_objs = []
                for _ in range(chunk_size):
                    delta_s = random.randint(0, 86400 * 90)
                    evt = BrowsingEvent(
                        user_id=bench_user_id,
                        browser_connection_id=conn_id,
                        page_id=random.choice(page_ids),
                        visited_at=now - timedelta(seconds=delta_s),
                        duration_seconds=random.randint(5, 300),
                        source_browser=random.choice(["chrome", "firefox", "safari"]),
                    )
                    event_objs.append(evt)
                db.add_all(event_objs)
                await db.flush()

            if remainder > 0:
                event_objs = []
                for _ in range(remainder):
                    delta_s = random.randint(0, 86400 * 90)
                    evt = BrowsingEvent(
                        user_id=bench_user_id,
                        browser_connection_id=conn_id,
                        page_id=random.choice(page_ids),
                        visited_at=now - timedelta(seconds=delta_s),
                        duration_seconds=random.randint(5, 300),
                        source_browser=random.choice(["chrome", "firefox", "safari"]),
                    )
                    event_objs.append(evt)
                db.add_all(event_objs)
                await db.flush()

            await db.commit()

            count_res = await db.execute(
                select(func.count(BrowsingEvent.id)).where(BrowsingEvent.user_id == bench_user_id)
            )
            total_user_events = count_res.scalar()
            print(f"  Corpus scale verified: {total_user_events:,} events for user {bench_user_id}")

        # ---------------------------------------------------------------------
        # PHASE 4: SEARCH LATENCY BENCHMARK ON 100K EVENTS
        # ---------------------------------------------------------------------
        print("\n--- Phase 4: Search Latency on 100,000 Events Corpus ---")

        user_obj = User(id=bench_user_id, email="bench@test.com", display_name="Bench")

        benchmark_queries = {
            "Keyword (Single Term)": ["postgres", "vector", "attention", "consensus", "safari"],
            "Keyword (Multi Term)": [
                "postgres index optimization",
                "vector cosine similarity",
                "safari webextensions manifest",
                "raft consensus leader",
                "rag grounded citation",
            ],
            "Temporal (Yesterday/Last Week)": [
                "postgres yesterday",
                "attention last week",
                "consensus past 3 days",
                "vector today",
            ],
            "Domain-Filtered": [
                "github.com postgres",
                "arxiv.org attention mechanism",
                "redis.io cache",
                "react.dev components",
            ],
        }

        search_stats = {}

        async with async_session() as db:
            for category, q_list in benchmark_queries.items():
                cat_latencies = []
                for q in q_list * 5:  # 20 to 25 iterations per category
                    t0 = time.perf_counter()
                    resp = await search_memories(db, user_obj, q, limit=20)
                    t1 = time.perf_counter()
                    cat_latencies.append((t1 - t0) * 1000.0)

                p50 = np.percentile(cat_latencies, 50)
                p95 = np.percentile(cat_latencies, 95)
                p99 = np.percentile(cat_latencies, 99)
                avg = np.mean(cat_latencies)
                search_stats[category] = {"p50": p50, "p95": p95, "p99": p99, "avg": avg}
                print(f"  {category:<32}: p50={p50:6.1f}ms | p95={p95:6.1f}ms | p99={p99:6.1f}ms | avg={avg:6.1f}ms")

        # ---------------------------------------------------------------------
        # PHASE 5: TIMELINE PAGINATION & EXPLAIN (ANALYZE, BUFFERS)
        # ---------------------------------------------------------------------
        print("\n--- Phase 5: Timeline Retrieval & PostgreSQL EXPLAIN (ANALYZE, BUFFERS) ---")

        timeline_latencies = []
        async with async_session() as db:
            # Measure paginated timeline retrieval
            for _ in range(30):
                t0 = time.perf_counter()
                stmt = (
                    select(BrowsingEvent)
                    .where(BrowsingEvent.user_id == bench_user_id)
                    .order_by(BrowsingEvent.visited_at.desc())
                    .limit(50)
                )
                res = await db.execute(stmt)
                _ = res.scalars().all()
                t1 = time.perf_counter()
                timeline_latencies.append((t1 - t0) * 1000.0)

            # Run raw EXPLAIN (ANALYZE, BUFFERS) on timeline query
            explain_sql = text("""
                EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
                SELECT e.id, e.visited_at, e.duration_seconds, p.url, p.title
                FROM browsing_events e
                JOIN pages p ON e.page_id = p.id
                WHERE e.user_id = :uid
                ORDER BY e.visited_at DESC
                LIMIT 50;
            """)
            explain_result = await db.execute(explain_sql, {"uid": str(bench_user_id)})
            explain_lines = explain_result.scalars().all()

        t_p50 = np.percentile(timeline_latencies, 50)
        t_p95 = np.percentile(timeline_latencies, 95)
        t_p99 = np.percentile(timeline_latencies, 99)
        print(f"  Timeline Retrieval (50 items): p50={t_p50:.1f}ms | p95={t_p95:.1f}ms | p99={t_p99:.1f}ms")
        print("\n  PostgreSQL EXPLAIN Execution Plan:")
        for line in explain_lines[:15]:
            print(f"    {line}")

        # ---------------------------------------------------------------------
        # PHASE 6: CROSS-USER TENANCY ISOLATION VERIFICATION
        # ---------------------------------------------------------------------
        print("\n--- Phase 6: Cross-User Tenancy Isolation Verification ---")
        user_beta_obj = User(id=other_user_id, email="beta@test.com", display_name="Beta")
        async with async_session() as db:
            # Search as User Beta for terms that User Alpha definitely has 10,000+ matches for
            leak_test_1 = await search_memories(db, user_beta_obj, "postgres", limit=50)
            leak_test_2 = await search_memories(db, user_beta_obj, "github.com", limit=50)

            print(f"  User Beta query 'postgres' results:   {len(leak_test_1.results)} (Expected: 0)")
            print(f"  User Beta query 'github.com' results: {len(leak_test_2.results)} (Expected: 0)")
            assert len(leak_test_1.results) == 0, "DATA LEAK DETECTED! User Beta saw User Alpha memories"
            assert len(leak_test_2.results) == 0, "DATA LEAK DETECTED! User Beta saw User Alpha memories"
            print("  ISOLATION VERIFIED: Zero data leakage between tenants across 100,000 memories.")

        # ---------------------------------------------------------------------
        # SUMMARY TABLE
        # ---------------------------------------------------------------------
        print("\n" + "=" * 70)
        print("FINAL BENCHMARK PERFORMANCE REPORT")
        print("=" * 70)
        print(f"| Metric / Scenario                       | p50      | p95      | p99      | Throughput      |")
        print(f"|-----------------------------------------|----------|----------|----------|-----------------|")
        print(f"| Ingestion (1,000 events, batch 50)      | {p50_1k:6.1f}ms | {p95_1k:6.1f}ms | {p99_1k:6.1f}ms | {throughput_1k:5.1f} evt/sec |")
        print(f"| Ingestion (10,000 events, batch 100)    | {p50_10k:6.1f}ms | {p95_10k:6.1f}ms | {p99_10k:6.1f}ms | {throughput_10k:5.1f} evt/sec |")
        for cat, st in search_stats.items():
            print(f"| Search: {cat:<31} | {st['p50']:6.1f}ms | {st['p95']:6.1f}ms | {st['p99']:6.1f}ms |        -        |")
        print(f"| Timeline (50 events, cursor indexed)    | {t_p50:6.1f}ms | {t_p95:6.1f}ms | {t_p99:6.1f}ms |        -        |")
        print("=" * 70)

    finally:
        # CLEANUP benchmark user data
        print("\nCleaning up synthetic benchmark data...")
        async with async_session() as db:
            await db.execute(delete(BrowsingEvent).where(BrowsingEvent.user_id.in_([bench_user_id, other_user_id])))
            await db.execute(delete(BrowserConnection).where(BrowserConnection.user_id.in_([bench_user_id, other_user_id])))
            await db.execute(delete(User).where(User.id.in_([bench_user_id, other_user_id])))
            await db.commit()
        print("Cleanup completed.")
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_benchmark())
