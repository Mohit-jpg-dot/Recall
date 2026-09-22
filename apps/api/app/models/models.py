"""
Recall API — ORM Models

All database models for the Recall application.
Designed for efficient storage of browsing events at scale —
separates Page identity from BrowsingEvent visits.
"""

import uuid
from datetime import datetime
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Users ────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    browser_connections: Mapped[list["BrowserConnection"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    browsing_events: Mapped[list["BrowsingEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    excluded_domains: Mapped[list["ExcludedDomain"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    memory_topics: Mapped[list["MemoryTopic"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    preferences: Mapped[list["UserPreference"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


# ── Browser Connections ──────────────────────────

class BrowserConnection(Base):
    __tablename__ = "browser_connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    browser_type: Mapped[str] = mapped_column(String(50), nullable=False)  # chrome, firefox, safari
    connection_name: Mapped[str] = mapped_column(String(100), nullable=False)
    auth_token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="browser_connections")
    browsing_events: Mapped[list["BrowsingEvent"]] = relationship(
        back_populates="browser_connection"
    )

    __table_args__ = (
        Index("idx_browser_connections_user_id", "user_id"),
    )


# ── Domains ──────────────────────────────────────

class Domain(Base):
    __tablename__ = "domains"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    domain_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    favicon_url: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    pages: Mapped[list["Page"]] = relationship(back_populates="domain")


# ── Pages ────────────────────────────────────────

class Page(Base):
    __tablename__ = "pages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(500))
    domain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("domains.id"), nullable=False
    )
    content_text: Mapped[Optional[str]] = mapped_column(Text)
    page_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    domain: Mapped["Domain"] = relationship(back_populates="pages")
    browsing_events: Mapped[list["BrowsingEvent"]] = relationship(back_populates="page")
    embeddings: Mapped[list["PageEmbedding"]] = relationship(
        back_populates="page", cascade="all, delete-orphan"
    )
    topics: Mapped[list["PageTopic"]] = relationship(
        back_populates="page", cascade="all, delete-orphan"
    )


# ── Browsing Sessions ────────────────────────────

class BrowsingSession(Base):
    __tablename__ = "browsing_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    inferred_topic: Mapped[Optional[str]] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    events: Mapped[list["BrowsingEvent"]] = relationship(back_populates="session")

    __table_args__ = (
        Index("idx_browsing_sessions_user_started", "user_id", "started_at"),
    )


# ── Browsing Events ─────────────────────────────

class BrowsingEvent(Base):
    __tablename__ = "browsing_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    browser_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("browser_connections.id"), nullable=False
    )
    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pages.id"), nullable=False
    )
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("browsing_sessions.id")
    )
    visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_browser: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    event_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="browsing_events")
    browser_connection: Mapped["BrowserConnection"] = relationship(
        back_populates="browsing_events"
    )
    page: Mapped["Page"] = relationship(back_populates="browsing_events")
    session: Mapped[Optional["BrowsingSession"]] = relationship(back_populates="events")
    search_query: Mapped[Optional["SearchQuery"]] = relationship(
        back_populates="browsing_event", uselist=False
    )

    __table_args__ = (
        Index("idx_browsing_events_user_visited", "user_id", "visited_at"),
        Index("idx_browsing_events_user_page", "user_id", "page_id"),
        Index("idx_browsing_events_session", "session_id"),
        Index("idx_browsing_events_connection", "browser_connection_id"),
    )


# ── Search Queries ───────────────────────────────

class SearchQuery(Base):
    __tablename__ = "search_queries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    browsing_event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("browsing_events.id", ondelete="CASCADE"), nullable=False
    )
    query_text: Mapped[str] = mapped_column(String(1000), nullable=False)
    search_engine: Mapped[Optional[str]] = mapped_column(String(50))
    searched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    browsing_event: Mapped["BrowsingEvent"] = relationship(back_populates="search_query")

    __table_args__ = (
        Index("idx_search_queries_user", "user_id"),
    )


# ── Page Embeddings ──────────────────────────────

class PageEmbedding(Base):
    __tablename__ = "page_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), nullable=False
    )
    embedding = mapped_column(Vector(1536))  # text-embedding-3-small dimension
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    page: Mapped["Page"] = relationship(back_populates="embeddings")

    __table_args__ = (
        Index("idx_page_embeddings_page", "page_id"),
    )


# ── Memory Topics ────────────────────────────────

class MemoryTopic(Base):
    __tablename__ = "memory_topics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#6366F1")
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="memory_topics")
    pages: Mapped[list["PageTopic"]] = relationship(back_populates="topic")

    __table_args__ = (
        UniqueConstraint("user_id", "slug", name="uq_user_topic_slug"),
    )


# ── Page Topics (association) ────────────────────

class PageTopic(Base):
    __tablename__ = "page_topics"

    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memory_topics.id", ondelete="CASCADE"), primary_key=True
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    # Relationships
    page: Mapped["Page"] = relationship(back_populates="topics")
    topic: Mapped["MemoryTopic"] = relationship(back_populates="pages")


# ── Excluded Domains ─────────────────────────────

class ExcludedDomain(Base):
    __tablename__ = "excluded_domains"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    domain_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "domain_name", name="uq_user_excluded_domain"),
        Index("idx_excluded_domains_user", "user_id"),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="excluded_domains")


# ── User Preferences ────────────────────────────

class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="preferences")

    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_user_preference_key"),
    )


# ── Conversations ────────────────────────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["ConversationMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_conversations_user", "user_id", "updated_at"),
    )


# ── Conversation Messages ────────────────────────

class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[Optional[dict]] = mapped_column(JSONB)  # Retrieved memories
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


# ── Memory Deletions (audit log) ─────────────────

class MemoryDeletion(Base):
    __tablename__ = "memory_deletions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    deletion_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'single', 'date', 'domain', 'all'
    deletion_criteria: Mapped[Optional[dict]] = mapped_column(JSONB)
    items_deleted: Mapped[int] = mapped_column(Integer, default=0)
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("idx_memory_deletions_user", "user_id"),
    )
