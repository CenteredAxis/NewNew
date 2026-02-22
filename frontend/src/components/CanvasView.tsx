import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { GraphNode } from "../types/chat";
import { graphToReactFlow } from "../lib/graphLayout";
import { GraphNodeCard } from "./GraphNodeCard";

interface CanvasViewProps {
  nodes: GraphNode[];
  activeNodeId: string | null;
  streaming: boolean;
  onNodeSelect: (id: string) => void;
  onFork: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onRefresh?: (nodeId: string) => void;
}

const nodeTypes = { graphNode: GraphNodeCard };

export function CanvasView({
  nodes: graphNodes,
  activeNodeId,
  streaming,
  onNodeSelect,
  onFork,
  onExecute,
  onRefresh,
}: CanvasViewProps) {
  // Convert DAG nodes to ReactFlow format with handlers injected
  const { rfNodes, rfEdges } = useMemo(() => {
    const { rfNodes: layoutNodes, rfEdges: layoutEdges } = graphToReactFlow(
      graphNodes,
      activeNodeId
    );

    // Inject streaming + callbacks into each node's data
    const enrichedNodes: RFNode[] = layoutNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        streaming,
        onFork,
        onExecute,
        onRefresh,
      },
    }));

    return { rfNodes: enrichedNodes, rfEdges: layoutEdges as RFEdge[] };
  }, [graphNodes, activeNodeId, streaming, onFork, onExecute, onRefresh]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  if (graphNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500 select-none">
        Start a conversation
      </div>
    );
  }

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-neutral-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={40}
          size={1}
          color="#404040"
        />
        <Controls
          className="!bg-neutral-800 !border-neutral-700 !shadow-lg [&>button]:!bg-neutral-800 [&>button]:!border-neutral-700 [&>button]:!text-neutral-400 [&>button:hover]:!bg-neutral-700"
        />
        <MiniMap
          className="!bg-neutral-900 !border-neutral-700"
          nodeColor={(node) => {
            const data = node.data as Record<string, unknown>;
            if (data?.isActive) return "#3b82f6";
            const graphNode = data?.node as GraphNode | undefined;
            if (graphNode?.role === "user") return "#60a5fa";
            return "#525252";
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </div>
  );
}
