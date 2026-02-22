"""
DAG-aware conversation and node API.

Replaces the linear chat model with a graph-based approach where
every message is a node in a DAG, and context is assembled by
walking backward from the active node to the root.
"""

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.dag import dag_walk, estimate_tokens
from ..core.database import get_db
from ..core.llm import stream_chat_completions
from ..models import Conversation, Node

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────


class CreateConversationReq(BaseModel):
    model: str
    title: str = "New conversation"


class CreateNodeReq(BaseModel):
    parent_id: str | None = None
    content: str
    role: str = "user"
    metadata: dict[str, Any] = Field(default_factory=dict)


class CompleteReq(BaseModel):
    parent_id: str
    model: str
    max_context_tokens: int = 100_000


class UpdateNodeMetadataReq(BaseModel):
    metadata: dict[str, Any]


# ── Helpers ───────────────────────────────────────────────────────


def node_to_dict(node: Node) -> dict:
    return {
        "id": str(node.id),
        "conversationId": str(node.conversation_id),
        "parentId": str(node.parent_id) if node.parent_id else None,
        "content": node.content,
        "role": node.role,
        "tokenCount": node.token_count,
        "metadata": node.metadata_ or {},
        "createdAt": node.created_at.isoformat() if node.created_at else None,
    }


def conv_to_dict(conv: Conversation) -> dict:
    return {
        "id": str(conv.id),
        "title": conv.title,
        "model": conv.model,
        "createdAt": conv.created_at.isoformat() if conv.created_at else None,
        "updatedAt": conv.updated_at.isoformat() if conv.updated_at else None,
    }


# ── Conversation CRUD ────────────────────────────────────────────


@router.post("/conversations")
async def create_conversation(
    req: CreateConversationReq, db: AsyncSession = Depends(get_db)
):
    conv = Conversation(title=req.title, model=req.model)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv_to_dict(conv)


@router.get("/conversations")
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc())
    )
    return [conv_to_dict(c) for c in result.scalars().all()]


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, uuid.UUID(conv_id))
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
    return {"ok": True}


# ── Node tree ─────────────────────────────────────────────────────


@router.get("/conversations/{conv_id}/tree")
async def get_tree(conv_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Node)
        .where(Node.conversation_id == uuid.UUID(conv_id))
        .order_by(Node.created_at)
    )
    nodes = result.scalars().all()
    return {"nodes": [node_to_dict(n) for n in nodes]}


@router.post("/conversations/{conv_id}/nodes")
async def create_node(
    conv_id: str, req: CreateNodeReq, db: AsyncSession = Depends(get_db)
):
    conv = await db.get(Conversation, uuid.UUID(conv_id))
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    node = Node(
        conversation_id=uuid.UUID(conv_id),
        parent_id=uuid.UUID(req.parent_id) if req.parent_id else None,
        content=req.content,
        role=req.role,
        token_count=estimate_tokens(req.content),
        metadata_=req.metadata,
    )
    db.add(node)

    # Update conversation title on first user message
    tree_result = await db.execute(
        select(Node).where(Node.conversation_id == uuid.UUID(conv_id)).limit(1)
    )
    if tree_result.scalar_one_or_none() is None and req.role == "user":
        conv.title = req.content[:60] or "New conversation"

    await db.commit()
    await db.refresh(node)
    return node_to_dict(node)


@router.patch("/conversations/{conv_id}/nodes/{node_id}/metadata")
async def update_node_metadata(
    conv_id: str,
    node_id: str,
    req: UpdateNodeMetadataReq,
    db: AsyncSession = Depends(get_db),
):
    node = await db.get(Node, uuid.UUID(node_id))
    if not node or str(node.conversation_id) != conv_id:
        raise HTTPException(status_code=404, detail="Node not found")
    current = node.metadata_ or {}
    current.update(req.metadata)
    node.metadata_ = current
    await db.commit()
    await db.refresh(node)
    return node_to_dict(node)


# ── DAG-aware completion (streaming) ──────────────────────────────


@router.post("/conversations/{conv_id}/complete")
async def complete(
    conv_id: str,
    req: CompleteReq,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    The key endpoint: assemble context via DAG walk, create an assistant
    node, stream the LLM response, and persist the result.
    """
    conv = await db.get(Conversation, uuid.UUID(conv_id))
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 1. DAG Walk — recursive CTE from parent_id to root
    context_nodes = await dag_walk(
        db, uuid.UUID(req.parent_id), max_tokens=req.max_context_tokens
    )

    if not context_nodes:
        raise HTTPException(status_code=400, detail="No context nodes found")

    # 2. Build messages array for the LLM
    messages = [{"role": n.role, "content": n.content} for n in context_nodes]

    # 3. Create empty assistant node (child of the user node)
    assistant_node = Node(
        conversation_id=uuid.UUID(conv_id),
        parent_id=uuid.UUID(req.parent_id),
        role="assistant",
        content="",
        token_count=0,
    )
    db.add(assistant_node)
    await db.commit()
    await db.refresh(assistant_node)

    assistant_id = str(assistant_node.id)

    # 4. Read LLM config from request headers (same pattern as existing proxy)
    endpoint_url: str | None = request.headers.get("x-endpoint-url")
    api_key: str | None = request.headers.get("x-api-key") or None

    async def stream_and_persist():
        """Stream LLM response to client, accumulate content, persist when done."""
        accumulated = ""

        # Send the assistant node ID as the first event so frontend knows it
        yield f"data: {json.dumps({'nodeId': assistant_id})}\n\n"

        payload = {
            "model": req.model,
            "messages": messages,
            "stream": True,
        }

        try:
            async for raw_chunk in stream_chat_completions(
                payload, endpoint_url=endpoint_url, api_key=api_key
            ):
                chunk_str = raw_chunk.decode("utf-8") if isinstance(raw_chunk, bytes) else raw_chunk
                # Parse SSE lines to accumulate content
                for line in chunk_str.split("\n"):
                    line = line.strip()
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        continue
                    try:
                        parsed = json.loads(data)
                        delta = parsed.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            accumulated += content
                    except (json.JSONDecodeError, IndexError, KeyError):
                        pass

                # Forward raw chunk to frontend
                yield raw_chunk if isinstance(raw_chunk, bytes) else raw_chunk.encode("utf-8")
        finally:
            # Persist the accumulated response
            async with get_db_session() as persist_db:
                node = await persist_db.get(Node, uuid.UUID(assistant_id))
                if node:
                    node.content = accumulated
                    node.token_count = estimate_tokens(accumulated)
                    await persist_db.commit()

    return StreamingResponse(
        stream_and_persist(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# Helper to get a fresh db session for persistence after streaming
from contextlib import asynccontextmanager
from ..core.database import async_session


@asynccontextmanager
async def get_db_session():
    async with async_session() as session:
        yield session
