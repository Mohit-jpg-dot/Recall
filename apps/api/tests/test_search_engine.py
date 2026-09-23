"""
Recall API Tests — Search Engine & Intent Reasoning
"""

import pytest


@pytest.mark.asyncio
async def test_keyword_and_domain_search(client, user_a):
    """Search by keyword and domain intent."""
    res = await client.post(
        "/api/search",
        headers=user_a["headers"],
        json={"query": "github langchain multi-agent"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert len(data["results"]) >= 1
    top = data["results"][0]
    assert "github.com" in top["domain"]
    assert "langchain" in top["title"].lower()
    assert top["relevance_score"] >= 0.4
    assert data["took_ms"] >= 0


@pytest.mark.asyncio
async def test_temporal_query_parsing(client, user_a):
    """Test queries with temporal intent phrases."""
    res = await client.post(
        "/api/search",
        headers=user_a["headers"],
        json={"query": "langchain from today"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "results" in data


@pytest.mark.asyncio
async def test_empty_query_results(client, user_a):
    """Search with non-matching query returns zero results gracefully."""
    res = await client.post(
        "/api/search",
        headers=user_a["headers"],
        json={"query": "nonexistent_term_xyz_123456789"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert len(data["results"]) == 0
