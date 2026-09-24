"""
Recall API — Pydantic Schemas

Request/response validation models for all API endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Auth Schemas ─────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserProfile"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User Schemas ─────────────────────────────────

class UserProfile(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    created_at: datetime
    memory_count: int = 0
    connected_browsers: int = 0

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)


# ── Browser Connection Schemas ───────────────────

class BrowserConnectRequest(BaseModel):
    browser_type: str = Field(pattern=r"^(chrome|firefox|safari|brave|edge)$")
    connection_name: str = Field(min_length=1, max_length=100)


class BrowserConnectionResponse(BaseModel):
    id: uuid.UUID
    browser_type: str
    connection_name: str
    is_active: bool
    is_paused: bool
    last_synced_at: Optional[datetime]
    created_at: datetime
    connection_token: Optional[str] = None  # Only returned on creation

    model_config = {"from_attributes": True}


class BrowserPairRequest(BaseModel):
    pairing_token: str = Field(min_length=10, max_length=255)
    browser_type: Optional[str] = Field("chrome", pattern=r"^(chrome|firefox|safari|brave|edge)$")
    connection_name: Optional[str] = Field(None, max_length=100)


class BrowserPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    connection_id: uuid.UUID
    browser_type: str
    connection_name: str


class BrowserUpdateRequest(BaseModel):
    is_paused: Optional[bool] = None
    connection_name: Optional[str] = None


# ── Event Schemas ────────────────────────────────

class PageMetadata(BaseModel):
    description: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image: Optional[str] = None
    favicon_url: Optional[str] = None
    search_query: Optional[str] = None
    search_engine: Optional[str] = None


class BrowsingEventPayload(BaseModel):
    url: str = Field(max_length=2048)
    title: Optional[str] = Field(None, max_length=500)
    domain: str = Field(max_length=255)
    visited_at: datetime
    source_browser: str = Field(pattern=r"^(chrome|firefox|safari|brave|edge)$")
    metadata: Optional[PageMetadata] = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class BatchEventsRequest(BaseModel):
    events: list[BrowsingEventPayload] = Field(min_length=1, max_length=50)
    connection_id: uuid.UUID


class BatchEventsResponse(BaseModel):
    accepted: int
    rejected: int
    errors: list[str] = []


# ── Memory Schemas ───────────────────────────────

class MemoryResponse(BaseModel):
    id: uuid.UUID
    url: str
    title: Optional[str]
    domain: str
    domain_favicon: Optional[str] = None
    visited_at: datetime
    source_browser: str
    visit_count: int = 1
    topics: list[str] = []

    model_config = {"from_attributes": True}


class MemoryListResponse(BaseModel):
    memories: list[MemoryResponse]
    total: int
    has_more: bool
    cursor: Optional[str] = None


# ── Search Schemas ───────────────────────────────

class SearchFilters(BaseModel):
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    domains: Optional[list[str]] = None
    browsers: Optional[list[str]] = None
    topics: Optional[list[str]] = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    filters: Optional[SearchFilters] = None
    limit: int = Field(default=10, ge=1, le=20)


class MatchReason(BaseModel):
    type: str  # semantic, keyword, temporal, session, domain
    description: str


class RelatedPage(BaseModel):
    title: Optional[str]
    domain: str
    url: str
    visited_at: datetime


class SearchResultItem(BaseModel):
    id: uuid.UUID
    url: str
    title: Optional[str]
    domain: str
    domain_favicon: Optional[str] = None
    visited_at: datetime
    source_browser: str
    relevance_score: float
    match_reasons: list[MatchReason] = []
    related_pages: list[RelatedPage] = []


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int
    took_ms: float


# ── Chat Schemas ─────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: Optional[uuid.UUID] = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    sources: list[SearchResultItem] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    message_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Timeline Schemas ─────────────────────────────

class TimelinePage(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    domain: str
    url: str
    visited_at: datetime


class TimelineSession(BaseModel):
    time: str
    topic: Optional[str] = None
    pages: list[TimelinePage]


class TimelineGroup(BaseModel):
    date: str
    sessions: list[TimelineSession]


class TimelineResponse(BaseModel):
    groups: list[TimelineGroup]
    has_more: bool
    cursor: Optional[str] = None


# ── Topic Schemas ────────────────────────────────

class TopicResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    color: str
    page_count: int = 0
    is_auto_generated: bool

    model_config = {"from_attributes": True}


class TopicUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


# ── Session Schemas ──────────────────────────────

class SessionPageResponse(BaseModel):
    title: Optional[str]
    domain: str
    url: str
    visited_at: datetime


class ResearchSessionResponse(BaseModel):
    id: uuid.UUID
    inferred_topic: Optional[str]
    page_count: int = 0
    started_at: datetime
    ended_at: datetime
    pages: list[SessionPageResponse] = []

    model_config = {"from_attributes": True}


# ── Privacy Schemas ──────────────────────────────

class ExcludedDomainResponse(BaseModel):
    id: uuid.UUID
    domain_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ExcludedDomainRequest(BaseModel):
    domain_name: str = Field(min_length=1, max_length=255)


class PrivacySettingsResponse(BaseModel):
    memory_active: bool
    excluded_domains: list[ExcludedDomainResponse]


# ── Generic ──────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


class PaginationParams(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    cursor: Optional[str] = None
