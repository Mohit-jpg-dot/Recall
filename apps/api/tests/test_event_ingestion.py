"""
Recall API Tests — Event Ingestion & Deduplication
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest


@pytest.mark.asyncio
async def test_batch_event_ingestion_success(client, user_a):
    """Test successful ingestion of a batch of browsing events."""
    now = datetime.now(timezone.utc)
    batch_payload = {
        "connection_id": str(user_a["connection_id"]),
        "events": [
            {
                "url": "https://docs.rs/tokio/latest/tokio/",
                "title": "tokio - Rust documentation",
                "domain": "docs.rs",
                "visited_at": (now - timedelta(minutes=5)).isoformat(),
                "source_browser": "chrome",
            },
            {
                "url": "https://news.ycombinator.com/item?id=12345",
                "title": "Show HN: Recall Web Memory",
                "domain": "news.ycombinator.com",
                "visited_at": (now - timedelta(minutes=2)).isoformat(),
                "source_browser": "chrome",
            },
        ],
    }

    res = await client.post("/api/events/batch", headers=user_a["headers"], json=batch_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["accepted"] == 2
    assert data["rejected"] == 0


@pytest.mark.asyncio
async def test_event_deduplication(client, user_a):
    """Test that visiting the same URL within 30 seconds is deduplicated."""
    now = datetime.now(timezone.utc)
    target_url = f"https://example.org/page-{uuid.uuid4().hex[:6]}"

    event_1 = {
        "url": target_url,
        "title": "Example Page",
        "domain": "example.org",
        "visited_at": now.isoformat(),
        "source_browser": "chrome",
    }
    # Send first event
    res1 = await client.post("/api/events/batch", headers=user_a["headers"], json={
        "connection_id": str(user_a["connection_id"]),
        "events": [event_1],
    })
    assert res1.status_code == 200
    assert res1.json()["accepted"] == 1

    # Send duplicate 10 seconds later
    event_dup = {
        "url": target_url,
        "title": "Example Page",
        "domain": "example.org",
        "visited_at": (now + timedelta(seconds=10)).isoformat(),
        "source_browser": "chrome",
    }
    res2 = await client.post("/api/events/batch", headers=user_a["headers"], json={
        "connection_id": str(user_a["connection_id"]),
        "events": [event_dup],
    })
    assert res2.status_code == 200
    assert res2.json()["accepted"] == 0
    assert res2.json()["rejected"] == 1


@pytest.mark.asyncio
async def test_excluded_domain_ingestion_filtering(client, user_a):
    """Events matching an excluded domain must be rejected during ingestion."""
    # 1. Add excluded domain
    add_res = await client.post(
        "/api/privacy/excluded-domains",
        headers=user_a["headers"],
        json={"domain_name": "chase.com"},
    )
    assert add_res.status_code == 201

    # 2. Try to ingest an event from that domain
    res = await client.post("/api/events/batch", headers=user_a["headers"], json={
        "connection_id": str(user_a["connection_id"]),
        "events": [
            {
                "url": "https://chase.com/login",
                "title": "Chase Bank Login",
                "domain": "chase.com",
                "visited_at": datetime.now(timezone.utc).isoformat(),
                "source_browser": "chrome",
            }
        ],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["accepted"] == 0
    assert data["rejected"] == 1
