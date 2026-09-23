"""
Recall API — Database Connection

Async SQLAlchemy engine and session factory.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency that provides a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables and indexes (development / startup)."""
    async with engine.begin() as conn:
        # Enable pgvector extension
        await conn.execute(
            __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector")
        )
        await conn.run_sync(Base.metadata.create_all)
        # Ensure performance indexes exist
        await conn.execute(__import__("sqlalchemy").text("CREATE INDEX IF NOT EXISTS idx_pages_domain_id ON pages (domain_id);"))
        await conn.execute(__import__("sqlalchemy").text("CREATE INDEX IF NOT EXISTS idx_pages_title ON pages (title);"))
        await conn.execute(__import__("sqlalchemy").text("CREATE INDEX IF NOT EXISTS idx_browsing_events_user_browser_visited ON browsing_events (user_id, source_browser, visited_at);"))
        await conn.execute(__import__("sqlalchemy").text("CREATE INDEX IF NOT EXISTS idx_browsing_events_created ON browsing_events (created_at);"))
        await conn.execute(__import__("sqlalchemy").text("CREATE INDEX IF NOT EXISTS idx_page_embeddings_vector ON page_embeddings USING hnsw (embedding vector_cosine_ops);"))
