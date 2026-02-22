import { memo, useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNode } from "../types/chat";
import { getNodeRenderer } from "../lib/nodeRenderers";

interface GraphNodeData {
  node: GraphNode;
  isActive: boolean;
  isActiveNode: boolean;
  hasChildren: boolean;
  childCount: number;
  streaming?: boolean;
  onFork?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onRefresh?: (nodeId: string) => void;
}

function GraphNodeCardInner({ data }: NodeProps) {
  const {
    node,
    isActive,
    isActiveNode,
    childCount,
    streaming,
    onFork,
    onExecute,
    onRefresh,
  } = data as unknown as GraphNodeData;

  const [expanded, setExpanded] = useState(false);

  const handleFork = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFork?.(node.id);
    },
    [node.id, onFork]
  );

  // Check for a custom renderer registered for this node type
  const nodeType = node.nodeType || "message";
  const CustomRenderer = getNodeRenderer(nodeType);

  const isDynamic = nodeType !== "message";
  const status = node.metadata?.status;

  const roleColor =
    node.role === "user"
      ? "border-blue-500"
      : node.role === "system"
        ? "border-amber-500"
        : isDynamic
          ? "border-purple-500"
          : "border-neutral-600";

  const activeBg = isActiveNode
    ? "bg-neutral-800 ring-2 ring-blue-500/50"
    : isActive
      ? "bg-neutral-800/80"
      : "bg-neutral-900/90";

  const maxH = expanded ? "max-h-[480px]" : "max-h-[120px]";
  const contentOverflow = !expanded && node.content.length > 200;

  return (
    <div
      className={`
        w-[280px] rounded-lg border-l-[3px] ${roleColor} ${activeBg}
        border border-neutral-700/50 shadow-lg
        transition-all duration-150
        hover:border-neutral-600
      `}
    >
      {/* Input handle (from parent) */}
      {node.parentId && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-neutral-500 !w-2 !h-2 !border-none"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-700/50">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isDynamic
                ? "bg-purple-400"
                : node.role === "user"
                  ? "bg-blue-400"
                  : node.role === "system"
                    ? "bg-amber-400"
                    : "bg-neutral-400"
            }`}
          />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
            {isDynamic ? nodeType : node.role}
          </span>
          {/* Status badge for dynamic nodes */}
          {isDynamic && status && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                status === "executing"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : status === "complete"
                    ? "bg-green-500/20 text-green-400"
                    : status === "error"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-neutral-500/20 text-neutral-400"
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-600 tabular-nums">
            ~{node.tokenCount}t
          </span>
          {childCount > 1 && (
            <span className="text-[10px] text-amber-500/70 tabular-nums">
              {childCount} branches
            </span>
          )}
          {/* Execute/Refresh buttons for dynamic nodes */}
          {isDynamic && status !== "executing" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (status === "complete") {
                  onRefresh?.(node.id);
                } else {
                  onExecute?.(node.id);
                }
              }}
              className="p-0.5 rounded text-neutral-600 hover:text-purple-400 hover:bg-neutral-700/50 transition-colors"
              title={status === "complete" ? "Refresh" : "Execute"}
            >
              {status === "complete" ? (
                /* Refresh icon */
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 8a7 7 0 0112.9-3.7M15 8a7 7 0 01-12.9 3.7" />
                  <path d="M14 1v3.3h-3.3M2 15v-3.3h3.3" />
                </svg>
              ) : (
                /* Play icon */
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
              )}
            </button>
          )}
          {isDynamic && status === "executing" && (
            <span className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          )}
          <button
            onClick={handleFork}
            className="p-0.5 rounded text-neutral-600 hover:text-blue-400 hover:bg-neutral-700/50 transition-colors"
            title="Fork from this node"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M5 3v4a2 2 0 002 2h2a2 2 0 002-2V3M5 3a2 2 0 10-4 0 2 2 0 004 0zM13 3a2 2 0 10-4 0 2 2 0 004 0zM8 9v4M8 13a2 2 0 10-4 0 2 2 0 004 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content — use custom renderer if registered */}
      {CustomRenderer ? (
        <div className="px-3 py-2">
          <CustomRenderer
            node={node}
            isActive={isActiveNode}
            streaming={!!streaming}
            onExecute={onExecute}
            onRefresh={onRefresh}
          />
        </div>
      ) : (
        <div
          className={`px-3 py-2 text-xs text-neutral-300 whitespace-pre-wrap break-words overflow-hidden ${maxH} cursor-pointer relative`}
          onClick={() => setExpanded((v) => !v)}
        >
          {node.content || (
            <span className="text-neutral-600 italic">
              {streaming ? "" : "(empty)"}
            </span>
          )}
          {streaming && isActiveNode && (
            <span className="inline-block w-1.5 h-3.5 bg-blue-400 animate-pulse ml-0.5 align-middle" />
          )}
          {/* Error display for dynamic nodes */}
          {node.metadata?.error && (
            <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1">
              {node.metadata.error}
            </div>
          )}
          {contentOverflow && !expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-neutral-900 to-transparent pointer-events-none" />
          )}
        </div>
      )}

      {/* Output handle (to children) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-neutral-500 !w-2 !h-2 !border-none"
      />
    </div>
  );
}

export const GraphNodeCard = memo(GraphNodeCardInner);
