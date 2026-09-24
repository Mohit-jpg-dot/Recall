"""
Recall API — Chat & RAG Service

Handles conversational memory exploration:
- Retrieves relevant memories with hybrid search
- Contextual grounding with citation enforcement
- Stores chat history in conversation models
- Optional OpenAI integration with graceful fallback
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fastapi import HTTPException, status
from app.config import settings
from app.models.models import Conversation, ConversationMessage, User
from app.schemas.schemas import (
    ChatMessageResponse,
    ConversationResponse,
    SearchResultItem,
)
from app.services.search_service import search_memories


async def get_or_create_conversation(
    db: AsyncSession,
    user: User,
    conversation_id: Optional[uuid.UUID],
    first_query: str,
) -> Conversation:
    """Retrieve existing conversation or create a new one."""
    if conversation_id:
        stmt = (
            select(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.user_id == user.id,
            )
            .options(selectinload(Conversation.messages))
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or access denied",
            )
        return conv

    # Create new conversation
    title = first_query[:60] + ("..." if len(first_query) > 60 else "")
    conv = Conversation(
        id=uuid.uuid4(),
        user_id=user.id,
        title=title,
    )
    db.add(conv)
    await db.flush()
    return conv


async def generate_grounded_response(
    query: str,
    sources: list[SearchResultItem],
) -> str:
    """
    Generate an AI response grounded strictly on retrieved browsing memories.
    Uses OpenAI if API key is provided, or a high-quality local synthesizer.
    """
    if not sources:
        return "I couldn't find enough evidence in your browsing memories."

    # If OpenAI API key is set, attempt call with compact context (top 4 sources max)
    if settings.openai_api_key:
        try:
            import httpx

            context_items = []
            for i, src in enumerate(sources[:4], 1):
                context_items.append(
                    f"[{i}] Title: {src.title}\n"
                    f"    URL: {src.url}\n"
                    f"    Domain: {src.domain}\n"
                    f"    Visited At: {src.visited_at.strftime('%Y-%m-%d %H:%M')}\n"
                    f"    Relevance: {src.relevance_score}\n"
                )
            context_str = "\n".join(context_items)

            system_prompt = (
                "You are Recall, a personal memory assistant for the user's web browsing history. "
                "Answer the user's question using ONLY the provided browsing memory sources. "
                "Be concise, precise, and grounded. Always cite the exact page titles, domains, and dates. "
                "Do NOT make up facts, URLs, dates, or events that do not appear in the sources. "
                "If evidence is insufficient, say: 'I couldn't find enough evidence in your browsing memories.' "
                "If several results are plausible, say: 'I found several possible matches in your browsing history.'"
            )

            user_prompt = f"User Question: {query}\n\nRetrieved Web Memories:\n{context_str}"

            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_chat_model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
        except Exception:
            pass  # Fallback to local synthesizer below

    # Deterministic high-quality grounded synthesis
    top = sources[0]
    q_lower = query.lower()
    
    # Categorize what the user asked for
    is_song_q = any(w in q_lower for w in ["song", "music", "track", "audio", "soundtrack", "album", "lyrics", "listen"])
    is_game_q = any(w in q_lower for w in ["game", "games", "gaming", "gamer", "play", "played"])
    is_movie_q = any(w in q_lower for w in ["movie", "movies", "film", "films", "cinema", "trailer"])

    # Filter out any generic homepages from sources if specific content pages are present
    content_sources = [
        s for s in sources 
        if not (s.url.rstrip('/') in ["https://www.youtube.com", "https://youtube.com", "https://www.google.com", "https://google.com"])
    ]
    curated_sources = content_sources if content_sources else sources

    if is_song_q:
        lines = ["Based on your browsing memory, you searched for and listened to this music:"]
        for i, s in enumerate(curated_sources[:4], 1):
            s_date = s.visited_at.strftime("%b %d, %Y")
            lines.append(f"{i}. **[{s.title}]({s.url})** on `{s.domain}` (visited {s_date})")
        return "\n\n".join(lines)

    if is_game_q:
        lines = ["In your browsing history, you searched for the following games:"]
        for i, s in enumerate(curated_sources[:4], 1):
            s_date = s.visited_at.strftime("%b %d, %Y")
            lines.append(f"{i}. **[{s.title}]({s.url})** on `{s.domain}` (visited {s_date})")
        return "\n\n".join(lines)

    if is_movie_q:
        lines = ["In your browsing history, you searched for and watched the following movie content:"]
        for i, s in enumerate(curated_sources[:4], 1):
            s_date = s.visited_at.strftime("%b %d, %Y")
            lines.append(f"{i}. **[{s.title}]({s.url})** on `{s.domain}` (visited {s_date})")
        return "\n\n".join(lines)

    # General grounded response
    top = curated_sources[0]
    date_str = top.visited_at.strftime("%B %d, %Y")

    if len(curated_sources) == 1:
        return (
            f"Based on your browsing memory, you visited **[{top.title}]({top.url})** on **{top.domain}** on **{date_str}**.\n\n"
            f"Match relevance: {int(top.relevance_score * 100)}%."
        )

    lines = [
        f"I found {len(curated_sources)} relevant memories for **\"{query}\"**:\n"
    ]
    for i, s in enumerate(curated_sources[:4], 1):
        s_date = s.visited_at.strftime("%b %d, %Y")
        lines.append(f"{i}. **[{s.title}]({s.url})** on `{s.domain}` (visited {s_date})")

    lines.append(
        f"\nThe most relevant record is **[{top.title}]({top.url})**, visited on {date_str}."
    )
    return "\n".join(lines)


async def process_chat(
    db: AsyncSession,
    user: User,
    message_text: str,
    conversation_id: Optional[uuid.UUID] = None,
) -> tuple[ChatMessageResponse, uuid.UUID]:
    """Execute chat interaction, retrieve memories, persist conversation."""
    conv = await get_or_create_conversation(db, user, conversation_id, message_text)

    # 1. Search relevant memories
    search_res = await search_memories(db, user, message_text, limit=6)
    sources = search_res.results

    # 2. Add user message
    user_msg = ConversationMessage(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        role="user",
        content=message_text,
    )
    db.add(user_msg)

    # 3. Synthesize assistant answer
    reply_content = await generate_grounded_response(message_text, sources)

    # 4. Serialize sources for persistence
    sources_data = [src.model_dump(mode="json") for src in sources]
    assistant_msg = ConversationMessage(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        role="assistant",
        content=reply_content,
        sources={"items": sources_data},
    )
    db.add(assistant_msg)
    conv.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(assistant_msg)

    response = ChatMessageResponse(
        id=assistant_msg.id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        sources=sources,
        created_at=assistant_msg.created_at,
    )
    return response, conv.id
