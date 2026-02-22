"""
Node type system: protocol, registry, and execution result.

Modules implement NodeTypeHandler to define custom node types.
The NodeTypeRegistry maps type strings to handler instances.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class ExecutionResult:
    """Result returned by a NodeTypeHandler.execute() call."""

    content: str
    """Updated human-readable content for the node (included in LLM context)."""

    output: dict[str, Any] = field(default_factory=dict)
    """Type-specific output data (stored in metadata.output)."""

    status: str = "complete"
    """Execution status: 'complete' or 'error'."""

    error: str | None = None
    """Error message when status is 'error'."""


class NodeTypeHandler(Protocol):
    """Protocol that modules implement to handle a specific node type."""

    node_type: str

    async def execute(
        self, node_data: dict[str, Any], db: AsyncSession
    ) -> ExecutionResult:
        """Execute the node's logic. node_data is the full serialized node dict."""
        ...

    def validate_input(self, input_data: dict[str, Any]) -> bool:
        """Validate type-specific input data before execution."""
        ...


class NodeTypeRegistry:
    """Central registry mapping node type strings to handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, NodeTypeHandler] = {}

    def register(self, handler: NodeTypeHandler) -> None:
        self._handlers[handler.node_type] = handler

    def get(self, node_type: str) -> NodeTypeHandler | None:
        return self._handlers.get(node_type)

    @property
    def registered_types(self) -> list[str]:
        return list(self._handlers.keys())


# Singleton instance — imported by routers and module loader
node_type_registry = NodeTypeRegistry()
