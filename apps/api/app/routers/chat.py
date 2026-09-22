"""
Recall API — Chat Router

Conversational AI endpoints for exploring personal web memories.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Conversation, ConversationMessage, User
from app.schemas.schemas import (
    ChatMessageResponse,
    ChatRequest,
    ConversationResponse,
    MessageResponse,
    SearchResultItem,
)
from app.services.chat_service import process_chat

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=dict)
async def chat_with_memory(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chat with Recall about past browsing sessions with citation-backed memory retrieval.
    """
    msg_response, conv_id = await process_chat(
        db=db,
        user=user,
        message_text=body.message,
        conversation_id=body.conversation_id,
    )

    return {
        "conversation_id": conv_id,
        "message": msg_response.model_dump(mode="json"),
    }


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List recent conversation threads for the user."""
    stmt = (
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(desc(Conversation.updated_at))
        .limit(30)
    )
    result = await db.execute(stmt)
    convs = result.scalars().all()

    items = []
    for c in convs:
        items.append(
            ConversationResponse(
                id=c.id,
                title=c.title or "Untitled Memory Search",
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )
    return items


@router.get("/conversations/{conversation_id}", response_model=list[ChatMessageResponse])
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages and citations in a specific conversation."""
    stmt = (
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
        .options(selectinload(Conversation.messages))
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    messages = sorted(conv.messages, key=lambda m: m.created_at)
    res: list[ChatMessageResponse] = []
    for m in messages:
        sources_list = []
        if m.sources and "items" in m.sources:
            for item in m.sources["items"]:
                try:
                    sources_list.append(SearchResultItem(**item))
                except Exception:
                    pass

        res.append(
            ChatMessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=sources_list,
                created_at=m.created_at,
            )
        )
    return res


@router.delete("/conversations/{conversation_id}", response_model=MessageResponse)
async def delete_conversation(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation thread."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == user.id,
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    await db.delete(conv)
    return MessageResponse(message="Conversation deleted")
