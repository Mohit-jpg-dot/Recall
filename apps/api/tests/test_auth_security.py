"""
Recall API Tests — Authentication & Strict Multi-Tenant Security Isolation

CRITICAL REQUIREMENT:
User A must NEVER be able to read, search, mutate, delete, or export User B's memories.
"""

import uuid
import pytest


@pytest.mark.asyncio
async def test_user_registration_and_login(client):
    """Test standard user registration, password verification, and authentication."""
    unique_email = f"test_{uuid.uuid4().hex[:8]}@getrecall.app"
    reg_payload = {
        "email": unique_email,
        "password": "SecurePassword123!",
        "display_name": "Test User",
    }
    # 1. Register
    reg_res = await client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == unique_email

    # 2. Duplicate registration rejected
    dup_res = await client.post("/api/auth/register", json=reg_payload)
    assert dup_res.status_code == 409

    # 3. Successful login
    login_res = await client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "SecurePassword123!",
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 4. Invalid credentials rejected
    bad_login = await client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword!",
    })
    assert bad_login.status_code == 401


@pytest.mark.asyncio
async def test_cross_user_memory_list_isolation(client, user_a, user_b):
    """User A must NEVER see User B's browsing events in /api/memory."""
    res_a = await client.get("/api/memory", headers=user_a["headers"])
    assert res_a.status_code == 200
    memories_a = res_a.json()["memories"]

    # Verify User A sees their own memory
    memory_ids_a = {m["id"] for m in memories_a}
    assert str(user_a["event_id"]) in memory_ids_a

    # Verify User B's memory is NOT present in User A's response
    assert str(user_b["event_id"]) not in memory_ids_a


@pytest.mark.asyncio
async def test_cross_user_memory_deletion_isolation(client, user_a, user_b):
    """User A must NOT be able to delete User B's memory."""
    # User A tries to delete User B's event ID
    del_res = await client.delete(f"/api/memory/{user_b['event_id']}", headers=user_a["headers"])
    # Must return 404 because from User A's perspective it doesn't exist
    assert del_res.status_code == 404

    # Verify User B's memory is still intact
    res_b = await client.get("/api/memory", headers=user_b["headers"])
    assert res_b.status_code == 200
    ids_b = {m["id"] for m in res_b.json()["memories"]}
    assert str(user_b["event_id"]) in ids_b


@pytest.mark.asyncio
async def test_cross_user_search_isolation(client, user_a, user_b):
    """User A searching for terms from User B's private history must return ZERO results."""
    # User B visited "private discussions on machine learning algorithms"
    # User A searches for "private discussions"
    search_res = await client.post(
        "/api/search",
        headers=user_a["headers"],
        json={"query": "private discussions machine learning"},
    )
    assert search_res.status_code == 200
    results = search_res.json()["results"]
    urls = [r["url"] for r in results]

    # User B's URL must not appear
    for url in urls:
        assert "private_beta_discussion" not in url


@pytest.mark.asyncio
async def test_cross_user_export_isolation(client, user_a, user_b):
    """Data export for User A must contain ONLY User A's data."""
    export_res = await client.get("/api/privacy/export", headers=user_a["headers"])
    assert export_res.status_code == 200
    data = export_res.json()

    assert data["user"]["email"] == user_a["user"].email
    export_urls = [m["url"] for m in data["memories"]]

    for u in export_urls:
        assert "private_beta_discussion" not in u


@pytest.mark.asyncio
async def test_cross_user_browsers_isolation(client, user_a, user_b):
    """User A must not see or modify User B's connected browsers."""
    res_a = await client.get("/api/browsers", headers=user_a["headers"])
    assert res_a.status_code == 200
    conn_ids = [c["id"] for c in res_a.json()]
    assert str(user_a["connection_id"]) in conn_ids
    assert str(user_b["connection_id"]) not in conn_ids
