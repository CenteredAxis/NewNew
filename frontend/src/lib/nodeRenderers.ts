import type { GraphNode } from "../types/chat";

/**
 * Props passed to custom node renderers registered by modules.
 */
export interface NodeRendererProps {
  node: GraphNode;
  isActive: boolean;
  streaming: boolean;
  onExecute?: (nodeId: string) => void;
  onRefresh?: (nodeId: string) => void;
}

type NodeRendererComponent = React.FC<NodeRendererProps>;

const registry = new Map<string, NodeRendererComponent>();

/** Register a custom renderer for a node type. */
export function registerNodeRenderer(
  nodeType: string,
  component: NodeRendererComponent
): void {
  registry.set(nodeType, component);
}

/** Get the custom renderer for a node type (undefined = use default). */
export function getNodeRenderer(
  nodeType: string
): NodeRendererComponent | undefined {
  return registry.get(nodeType);
}

/** List all registered node types that have custom renderers. */
export function getRegisteredNodeTypes(): string[] {
  return Array.from(registry.keys());
}
