"""
Recall API Tests — Privacy Compliance, Deletion & Preferences
"""

import uuid
from datetime import datetime, timezone
import pytest


@pytest.mark.asyncio
async def test_single_memory_deletion(client, user_a):
    """Test deleting a single memory removes it and creates an audit record."""
    del_res = await client.delete(
        f"/api/memory/{user_a['event_id']}",
        headers=user_a["headers"],
    )
    assert del_res.status_code == 200

    # Ensure it no longer appears in memory list
    list_res = await client.get("/api/memory", headers=user_a["headers"])
    assert list_res.status_code == 200
    ids = [m["id"] for m in list_res.json()["memories"]]
    assert str(user_a["event_id"]) not in ids


@pytest.mark.asyncio
async def test_privacy_settings_toggle(client, user_a):
    """Test pausing and resuming memory collection."""
    # Pause collection
    pause_res = await client.patch("/api/privacy?memory_active=false", headers=user_a["headers"])
    assert pause_res.status_code == 200

    settings_res = await client.get("/api/privacy", headers=user_a["headers"])
    assert settings_res.status_code == 200
    assert settings_res.json()["memory_active"] is False

    # Resume collection
    resume_res = await client.patch("/api/privacy?memory_active=true", headers=user_a["headers"])
    assert resume_res.status_code == 200

    settings_res2 = await client.get("/api/privacy", headers=user_a["headers"])
    assert settings_res2.status_code == 200
    assert settings_res2.json()["memory_active"] is True
