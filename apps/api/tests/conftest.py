"""
Recall API Tests — Pytest Configuration & Fixtures

Sets up async test database sessions, HTTP test client, and test users
specifically structured to rigorously test cross-user isolation and security.
"""

import asyncio
import uuid
from datetime import datetime, timezone
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.models.models import BrowserConnection, BrowsingEvent, Domain, Page, User
from app.services.auth_service import create_access_token, hash_password
from sqlalchemy import select
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import get_db, init_db

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
TestAsyncSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestAsyncSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Initialize database tables and vector extensions once before test run."""
    await init_db()
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session():
    """Yield a database session for direct test operations."""
    async with TestAsyncSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture
async def client():
    """Async HTTP test client bound to the FastAPI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def user_a(db_session):
    """Create User A for tenancy testing."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"user_a_{user_id.hex[:6]}@example.com",
        password_hash=hash_password("Password123!"),
        display_name="User Alpha",
    )
    db_session.add(user)

    conn_id = uuid.uuid4()
    conn = BrowserConnection(
        id=conn_id,
        user_id=user_id,
        browser_type="chrome",
        connection_name="Alpha Chrome",
        auth_token_hash=hash_password("alpha-token"),
        is_active=True,
        is_paused=False,
    )
    db_session.add(conn)

    # Add or get domain and page for user A
    dom_res = await db_session.execute(select(Domain).where(Domain.domain_name == "github.com"))
    domain = dom_res.scalar_one_or_none()
    if not domain:
        domain = Domain(id=uuid.uuid4(), domain_name="github.com", favicon_url="https://github.com/favicon.ico")
        db_session.add(domain)
        await db_session.flush()

    page_url_a = f"https://github.com/langchain-ai/langchain_{uuid.uuid4().hex[:6]}"
    page = Page(
        id=uuid.uuid4(),
        url=page_url_a,
        title="langchain-ai/langchain: Multi-agent systems in Python",
        domain_id=domain.id,
        content_text="LangChain is a framework for developing applications powered by language models.",
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    db_session.add(page)
    await db_session.flush()

    ev_id = uuid.uuid4()
    event = BrowsingEvent(
        id=ev_id,
        user_id=user_id,
        browser_connection_id=conn_id,
        page_id=page.id,
        visited_at=datetime.now(timezone.utc),
        source_browser="chrome",
    )
    db_session.add(event)

    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token(user.id)
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "connection_id": conn_id,
        "page_id": page.id,
        "event_id": ev_id,
    }


@pytest_asyncio.fixture
async def user_b(db_session):
    """Create User B for tenancy isolation testing."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"user_b_{user_id.hex[:6]}@example.com",
        password_hash=hash_password("Password123!"),
        display_name="User Beta",
    )
    db_session.add(user)

    conn_id = uuid.uuid4()
    conn = BrowserConnection(
        id=conn_id,
        user_id=user_id,
        browser_type="firefox",
        connection_name="Beta Firefox",
        auth_token_hash=hash_password("beta-token"),
        is_active=True,
        is_paused=False,
    )
    db_session.add(conn)

    # Add or get domain and page for user B
    dom_res = await db_session.execute(select(Domain).where(Domain.domain_name == "reddit.com"))
    domain = dom_res.scalar_one_or_none()
    if not domain:
        domain = Domain(id=uuid.uuid4(), domain_name="reddit.com", favicon_url="https://reddit.com/favicon.ico")
        db_session.add(domain)
        await db_session.flush()

    page_url_b = f"https://reddit.com/r/MachineLearning/private_beta_{uuid.uuid4().hex[:6]}"
    page = Page(
        id=uuid.uuid4(),
        url=page_url_b,
        title="Private discussions on machine learning algorithms",
        domain_id=domain.id,
        content_text="Confidential beta user research discussion.",
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    db_session.add(page)
    await db_session.flush()

    ev_id = uuid.uuid4()
    event = BrowsingEvent(
        id=ev_id,
        user_id=user_id,
        browser_connection_id=conn_id,
        page_id=page.id,
        visited_at=datetime.now(timezone.utc),
        source_browser="firefox",
    )
    db_session.add(event)

    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token(user.id)
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "connection_id": conn_id,
        "page_id": page.id,
        "event_id": ev_id,
    }
