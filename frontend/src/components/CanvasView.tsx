import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import { WorkspaceNodePicker } from "./WorkspaceNodePicker";

interface CanvasViewProps {
  nodes: GraphNode[];
  activeNodeId: string | null;
  streaming: boolean;
  onNodeSelect: (id: string) => void;
  onFork: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onRefresh?: (nodeId: string) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onCreateWorkspaceNode?: (nodeType: string, x: number, y: number) => void;
}

interface PickerState {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
}

const nodeTypes = { graphNode: GraphNodeCard };

/**
 * Inner component — must be inside ReactFlowProvider to use useReactFlow.
 */
function CanvasViewInner({
  nodes: graphNodes,
  activeNodeId,
  streaming,
  onNodeSelect,
  onFork,
  onExecute,
  onRefresh,
  onNodeMove,
  onCreateWorkspaceNode,
}: CanvasViewProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

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

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      onNodeMove?.(node.id, node.position.x, node.position.y);
    },
    [onNodeMove]
  );

  // Double-click on the canvas pane (not on nodes/edges) opens the node picker.
  // onPaneDoubleClick doesn't exist in @xyflow/react v12, so we use the wrapper
  // div's onDoubleClick and filter out clicks that land on ReactFlow elements.
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as Element;
      if (
        target.closest(".react-flow__node") ||
        target.closest(".react-flow__edge") ||
        target.closest(".react-flow__controls") ||
        target.closest(".react-flow__minimap")
      ) {
        return;
      }
      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setPickerState({
        screenX: event.clientX,
        screenY: event.clientY,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    },
    [screenToFlowPosition]
  );

  const handlePickerSelect = useCallback(
    (nodeType: string) => {
      if (pickerState) {
        onCreateWorkspaceNode?.(nodeType, pickerState.flowX, pickerState.flowY);
        setPickerState(null);
      }
    },
    [pickerState, onCreateWorkspaceNode]
  );

  return (
    <>
      {/* Wrapper div captures double-clicks on the canvas background */}
      <div
        className="absolute inset-0"
        onDoubleClick={handleDoubleClick}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable={true}
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

      {pickerState && (
        <WorkspaceNodePicker
          screenX={pickerState.screenX}
          screenY={pickerState.screenY}
          onSelect={handlePickerSelect}
          onDismiss={() => setPickerState(null)}
        />
      )}
    </>
  );
}

export function CanvasView(props: CanvasViewProps) {
  return (
    <div className="flex-1 h-full relative">
      <ReactFlowProvider>
        <CanvasViewInner {...props} />
      </ReactFlowProvider>
      {props.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 select-none pointer-events-none gap-1">
          <span>Send a message to start</span>
          <span className="text-[11px] text-neutral-600">
            or double-click to add a workspace node
          </span>
        </div>
      )}
    </div>
  );
}
