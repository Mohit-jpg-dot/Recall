"""
Recall API Tests — Conversational Memory & Grounded RAG
"""

import pytest


@pytest.mark.asyncio
async def test_chat_grounded_response_with_citations(client, user_a):
    """Chat querying memories returns grounded answer citing exact title and URL."""
    res = await client.post(
        "/api/chat",
        headers=user_a["headers"],
        json={"message": "What did I look at on GitHub about langchain?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "conversation_id" in data
    assert "message" in data
    msg = data["message"]
    assert msg["role"] == "assistant"
    assert "github.com" in msg["content"].lower() or "langchain" in msg["content"].lower()
    assert len(msg["sources"]) >= 1


@pytest.mark.asyncio
async def test_chat_insufficient_evidence_fallback(client, user_a):
    """When query has zero matching memories, system outputs standard insufficient evidence response."""
    res = await client.post(
        "/api/chat",
        headers=user_a["headers"],
        json={"message": "Tell me about my trip to Antarctica yesterday"},
    )
    assert res.status_code == 200
    data = res.json()
    content = data["message"]["content"]
    assert "couldn't find enough evidence" in content.lower()
