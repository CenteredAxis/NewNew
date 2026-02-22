"""
DAG traversal logic for context assembly.

The core algorithm: walk backward from a target node to the root,
accumulating tokens until the context budget is exhausted.
Uses PostgreSQL Recursive CTEs for efficient graph traversal.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class ContextNode:
    """A node in the assembled context, ordered from root → target."""

    node_id: uuid.UUID
    parent_id: uuid.UUID | None
    content: str
    role: str
    token_count: int
    depth: int


async def dag_walk(
    db: AsyncSession,
    target_node_id: uuid.UUID,
    max_tokens: int = 100_000,
) -> list[ContextNode]:
    """
    Walk the DAG backward from target_node_id to the root node.

    Returns nodes ordered from root (depth DESC → shallowest first) to target,
    suitable for direct use as an LLM messages array.

    The recursive CTE stops accumulating once running_total exceeds max_tokens,
    ensuring the assembled context fits within the model's context window.
    """
    query = text("""
        WITH RECURSIVE context_assembly AS (
            -- Anchor: start at the target node
            SELECT
                n.id AS node_id,
                n.parent_id,
                n.content,
                n.role,
                n.token_count,
                n.token_count AS running_total,
                0 AS depth
            FROM nodes n
            WHERE n.id = :target_node_id

            UNION ALL

            -- Recursive step: walk to parent
            SELECT
                n.id AS node_id,
                n.parent_id,
                n.content,
                n.role,
                n.token_count,
                ca.running_total + n.token_count,
                ca.depth + 1
            FROM nodes n
            INNER JOIN context_assembly ca ON n.id = ca.parent_id
            WHERE ca.running_total < :max_tokens
        )
        SELECT node_id, parent_id, content, role, token_count, depth
        FROM context_assembly
        ORDER BY depth DESC;
    """)

    result = await db.execute(
        query,
        {"target_node_id": str(target_node_id), "max_tokens": max_tokens},
    )

    return [
        ContextNode(
            node_id=uuid.UUID(str(row.node_id)),
            parent_id=uuid.UUID(str(row.parent_id)) if row.parent_id else None,
            content=row.content,
            role=row.role,
            token_count=row.token_count,
            depth=row.depth,
        )
        for row in result.fetchall()
    ]


def estimate_tokens(content: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(content) // 4)
