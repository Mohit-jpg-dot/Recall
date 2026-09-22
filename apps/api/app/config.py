"""
Recall API — Configuration

Loads settings from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── App ──────────────────────────────────
    app_name: str = "Recall"
    debug: bool = False

    # ── Database ─────────────────────────────
    database_url: str = "postgresql+asyncpg://recall:recall_dev_password@localhost:5432/recall"

    # ── Redis ────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── JWT ──────────────────────────────────
    jwt_secret_key: str = "change-this-to-a-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # ── CORS ─────────────────────────────────
    api_cors_origins: str = "http://localhost:5173"

    # ── AI Providers ─────────────────────────
    llm_provider: str = "openai"
    embedding_provider: str = "openai"

    openai_api_key: Optional[str] = None
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"

    # ── Rate Limiting ────────────────────────
    rate_limit_per_minute: int = 60
    batch_rate_limit_per_minute: int = 30

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
