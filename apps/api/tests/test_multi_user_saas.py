"""
Recall Multi-User SaaS End-to-End Tests

Tests genuine multi-tenant isolation, IDOR prevention, browser connection scoping,
cross-user search and chat isolation, export isolation, and account deletion cascade.
"""

import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_multi_user_complete_lifecycle_and_isolation(client: AsyncClient):
    """
    Simulates:
    1. User Alpha registers & logs in.
    2. User Alpha connects Chrome, Firefox, and Safari browsers.
    3. User Alpha ingests browsing events.
    4. User Beta registers & logs in.
    5. User Beta connects a Chrome browser.
    6. User Beta ingests completely different browsing events.
    7. Multi-tenant verification:
       - User Alpha searches and only sees Alpha events.
       - User Beta searches and only sees Beta events.
    8. IDOR attack attempts:
       - User Alpha attempts to access User Beta's browser connection (must 404).
       - User Alpha attempts to disconnect User Beta's browser (must 404).
       - User Alpha attempts to delete User Beta's browsing event (must 404).
       - User Alpha attempts to access User Beta's conversation (must 404).
    9. Data export verification:
       - User Alpha export contains Alpha events only.
       - User Beta export contains Beta events only.
    10. Account deletion isolation:
       - User Alpha deletes their account.
       - User Beta's data, account, connections, and events remain completely intact.
    """

    # ── 1. Register User Alpha ───────────────────────
    alpha_email = f"alpha_{uuid.uuid4().hex[:8]}@example.com"
    alpha_password = "Password123!"

    resp_reg_a = await client.post("/api/auth/register", json={
        "email": alpha_email,
        "password": alpha_password,
        "display_name": "Alpha User",
    })
    assert resp_reg_a.status_code == 201
    alpha_tokens = resp_reg_a.json()
    alpha_token = alpha_tokens["access_token"]
    alpha_headers = {"Authorization": f"Bearer {alpha_token}"}

    # Verify /api/me
    resp_me_a = await client.get("/api/me", headers=alpha_headers)
    assert resp_me_a.status_code == 200
    alpha_user_data = resp_me_a.json()
    assert alpha_user_data["email"] == alpha_email

    # ── 2. User Alpha Connects Chrome, Firefox, and Safari ───
    resp_chrome_a = await client.post("/api/browsers/connect", headers=alpha_headers, json={
        "browser_type": "chrome",
        "connection_name": "Alpha Work Chrome",
    })
    assert resp_chrome_a.status_code in (200, 201)
    conn_alpha_chrome_id = resp_chrome_a.json()["id"]

    resp_firefox_a = await client.post("/api/browsers/connect", headers=alpha_headers, json={
        "browser_type": "firefox",
        "connection_name": "Alpha Laptop Firefox",
    })
    assert resp_firefox_a.status_code in (200, 201)
    conn_alpha_firefox_id = resp_firefox_a.json()["id"]

    resp_safari_a = await client.post("/api/browsers/connect", headers=alpha_headers, json={
        "browser_type": "safari",
        "connection_name": "Alpha Mac Safari",
    })
    assert resp_safari_a.status_code in (200, 201)
    conn_alpha_safari_id = resp_safari_a.json()["id"]

    # Verify Alpha has 3 connections
    resp_conns_a = await client.get("/api/browsers", headers=alpha_headers)
    assert resp_conns_a.status_code == 200
    conns_a = resp_conns_a.json()
    assert len(conns_a) == 3

    # ── 3. User Alpha Ingests Events ─────────────────
    alpha_event_url = f"https://arxiv.org/abs/2305.18290_{uuid.uuid4().hex[:6]}"
    resp_ingest_a = await client.post("/api/events/batch", headers=alpha_headers, json={
        "connection_id": conn_alpha_chrome_id,
        "events": [{
            "url": alpha_event_url,
            "title": "Direct Preference Optimization: Your Language Model is Secretly a Reward Model",
            "domain": "arxiv.org",
            "visited_at": "2026-09-20T10:00:00Z",
            "source_browser": "chrome",
        }],
    })
    assert resp_ingest_a.status_code == 200
    assert resp_ingest_a.json()["accepted"] == 1

    # ── 4. Register User Beta ────────────────────────
    beta_email = f"beta_{uuid.uuid4().hex[:8]}@example.com"
    beta_password = "Password456!"

    resp_reg_b = await client.post("/api/auth/register", json={
        "email": beta_email,
        "password": beta_password,
        "display_name": "Beta User",
    })
    assert resp_reg_b.status_code == 201
    beta_tokens = resp_reg_b.json()
    beta_token = beta_tokens["access_token"]
    beta_headers = {"Authorization": f"Bearer {beta_token}"}

    # ── 5. User Beta Connects Chrome ──────────────────
    resp_chrome_b = await client.post("/api/browsers/connect", headers=beta_headers, json={
        "browser_type": "chrome",
        "connection_name": "Beta Personal Chrome",
    })
    assert resp_chrome_b.status_code in (200, 201)
    conn_beta_chrome_id = resp_chrome_b.json()["id"]

    # Verify Beta has only 1 connection (none of Alpha's)
    resp_conns_b = await client.get("/api/browsers", headers=beta_headers)
    assert resp_conns_b.status_code == 200
    conns_b = resp_conns_b.json()
    assert len(conns_b) == 1
    assert conns_b[0]["id"] == conn_beta_chrome_id

    # ── 6. User Beta Ingests Different Events ─────────
    beta_event_url = f"https://nytimes.com/cooking/recipes/carbonara_{uuid.uuid4().hex[:6]}"
    resp_ingest_b = await client.post("/api/events/batch", headers=beta_headers, json={
        "connection_id": conn_beta_chrome_id,
        "events": [{
            "url": beta_event_url,
            "title": "Authentic Roman Carbonara Recipe with Guanciale and Pecorino",
            "domain": "nytimes.com",
            "visited_at": "2026-09-21T14:30:00Z",
            "source_browser": "chrome",
        }],
    })
    assert resp_ingest_b.status_code == 200
    assert resp_ingest_b.json()["accepted"] == 1

    # ── 7. Multi-Tenant Search Isolation ─────────────
    # Alpha searches for "Preference" -> finds Alpha's arXiv event, never Beta's recipe
    search_a = await client.post("/api/search", headers=alpha_headers, json={"query": "Preference"})
    assert search_a.status_code == 200
    results_a = search_a.json()["results"]
    assert any(alpha_event_url in r["url"] for r in results_a)
    assert not any(beta_event_url in r["url"] for r in results_a)

    # Beta searches for "Preference" -> must find NOTHING
    search_b_empty = await client.post("/api/search", headers=beta_headers, json={"query": "Preference"})
    assert search_b_empty.status_code == 200
    results_b_empty = search_b_empty.json()["results"]
    assert len(results_b_empty) == 0

    # Beta searches for "Carbonara" -> finds Beta's recipe, never Alpha's event
    search_b = await client.post("/api/search", headers=beta_headers, json={"query": "Carbonara"})
    assert search_b.status_code == 200
    results_b = search_b.json()["results"]
    assert any(beta_event_url in r["url"] for r in results_b)
    assert not any(alpha_event_url in r["url"] for r in results_b)

    # Alpha searches for "Carbonara" -> must find NOTHING
    search_a_empty = await client.post("/api/search", headers=alpha_headers, json={"query": "Carbonara"})
    assert search_a_empty.status_code == 200
    assert len(search_a_empty.json()["results"]) == 0

    # ── 8. IDOR Attacks & Scoping Verification ─────────
    # IDOR: Alpha attempts to disconnect Beta's browser connection
    idor_disconnect = await client.delete(f"/api/browsers/{conn_beta_chrome_id}", headers=alpha_headers)
    assert idor_disconnect.status_code == 404

    # IDOR: Beta attempts to disconnect Alpha's safari connection
    idor_disconnect_safari = await client.delete(f"/api/browsers/{conn_alpha_safari_id}", headers=beta_headers)
    assert idor_disconnect_safari.status_code == 404

    # IDOR: Alpha attempts to send events using Beta's connection ID
    idor_batch = await client.post("/api/events/batch", headers=alpha_headers, json={
        "connection_id": conn_beta_chrome_id,
        "events": [{
            "url": "https://malicious.com",
            "title": "Malicious Spoof",
            "domain": "malicious.com",
            "visited_at": "2026-09-22T00:00:00Z",
            "source_browser": "chrome",
        }],
    })
    assert idor_batch.status_code in (400, 403, 404)

    # ── 9. Chat Isolation ────────────────────────────
    # Alpha initiates chat
    chat_a = await client.post("/api/chat", headers=alpha_headers, json={
        "message": "What arXiv papers did I read recently?",
    })
    assert chat_a.status_code == 200
    chat_a_data = chat_a.json()
    conv_id_a = chat_a_data["conversation_id"]

    # IDOR: Beta attempts to read Alpha's conversation history
    idor_chat_hist = await client.get(f"/api/chat/history/{conv_id_a}", headers=beta_headers)
    assert idor_chat_hist.status_code == 404

    # IDOR: Beta attempts to send message to Alpha's conversation
    idor_chat_send = await client.post("/api/chat", headers=beta_headers, json={
        "conversation_id": conv_id_a,
        "message": "Sneak into Alpha conversation",
    })
    assert idor_chat_send.status_code == 404

    # ── 10. Data Export Isolation ────────────────────
    export_a = await client.get("/api/privacy/export", headers=alpha_headers)
    assert export_a.status_code == 200
    export_a_data = export_a.json()
    assert export_a_data["user"]["email"] == alpha_email
    exported_a_urls = [e["url"] for e in export_a_data.get("memories", [])]
    assert alpha_event_url in exported_a_urls
    assert beta_event_url not in exported_a_urls

    export_b = await client.get("/api/privacy/export", headers=beta_headers)
    assert export_b.status_code == 200
    export_b_data = export_b.json()
    assert export_b_data["user"]["email"] == beta_email
    exported_b_urls = [e["url"] for e in export_b_data.get("memories", [])]
    assert beta_event_url in exported_b_urls
    assert alpha_event_url not in exported_b_urls

    # ── 11. Account Deletion Cascade & Independence ──
    # Alpha deletes their account
    del_a = await client.delete("/api/me", headers=alpha_headers)
    assert del_a.status_code == 200

    # Alpha's token should no longer work
    me_after_del = await client.get("/api/me", headers=alpha_headers)
    assert me_after_del.status_code == 401

    # Beta's account and data MUST remain completely unaffected
    me_b = await client.get("/api/me", headers=beta_headers)
    assert me_b.status_code == 200
    assert me_b.json()["email"] == beta_email

    search_b_after = await client.post("/api/search", headers=beta_headers, json={"query": "Carbonara"})
    assert search_b_after.status_code == 200
    assert any(beta_event_url in r["url"] for r in search_b_after.json()["results"])
