import type { GraphNode } from "../types/chat";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;
const H_GAP = 60;
const V_GAP = 80;

interface TreeNode {
  node: GraphNode;
  children: TreeNode[];
  x: number;
  y: number;
  width: number;
}

/**
 * Convert a flat array of GraphNode[] into ReactFlow nodes + edges.
 * Computes a top-down tree layout with horizontal spreading for branches.
 */
export function graphToReactFlow(
  nodes: GraphNode[],
  activeNodeId: string | null
): { rfNodes: RFNode[]; rfEdges: RFEdge[] } {
  if (nodes.length === 0) return { rfNodes: [], rfEdges: [] };

  // Build parent → children map
  const childrenMap = new Map<string | null, GraphNode[]>();
  const nodeMap = new Map<string, GraphNode>();

  for (const n of nodes) {
    nodeMap.set(n.id, n);
    const parentKey = n.parentId;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(n);
  }

  // Find roots (nodes with null parentId)
  const roots = childrenMap.get(null) ?? [];

  // Build tree structure recursively
  function buildTree(node: GraphNode, depth: number): TreeNode {
    const children = (childrenMap.get(node.id) ?? [])
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((child) => buildTree(child, depth + 1));

    return {
      node,
      children,
      x: 0,
      y: depth * (NODE_HEIGHT + V_GAP),
      width: NODE_WIDTH,
    };
  }

  // Compute widths bottom-up (for horizontal layout)
  function computeWidth(tree: TreeNode): number {
    if (tree.children.length === 0) {
      tree.width = NODE_WIDTH;
      return tree.width;
    }
    const childWidths = tree.children.map(computeWidth);
    tree.width = childWidths.reduce((sum, w) => sum + w, 0) + (tree.children.length - 1) * H_GAP;
    return Math.max(tree.width, NODE_WIDTH);
  }

  // Position nodes horizontally
  function positionX(tree: TreeNode, left: number): void {
    if (tree.children.length === 0) {
      tree.x = left + (tree.width - NODE_WIDTH) / 2;
      return;
    }

    let cursor = left;
    for (const child of tree.children) {
      positionX(child, cursor);
      cursor += child.width + H_GAP;
    }

    // Center parent over children
    const firstChild = tree.children[0];
    const lastChild = tree.children[tree.children.length - 1];
    tree.x = (firstChild.x + lastChild.x) / 2;
  }

  // Build the active lineage set for highlighting
  const activeLineage = new Set<string>();
  if (activeNodeId) {
    let current = nodeMap.get(activeNodeId);
    while (current) {
      activeLineage.add(current.id);
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
  }

  // Flatten tree into ReactFlow nodes + edges
  const rfNodes: RFNode[] = [];
  const rfEdges: RFEdge[] = [];

  function flatten(tree: TreeNode): void {
    const isActive = activeLineage.has(tree.node.id);
    const isActiveNode = tree.node.id === activeNodeId;

    // Use metadata position if set, otherwise computed layout
    const x = tree.node.metadata?.x != null ? (tree.node.metadata.x as number) : tree.x;
    const y = tree.node.metadata?.y != null ? (tree.node.metadata.y as number) : tree.y;

    rfNodes.push({
      id: tree.node.id,
      type: "graphNode",
      position: { x, y },
      data: {
        node: tree.node,
        isActive,
        isActiveNode,
        hasChildren: tree.children.length > 0,
        childCount: tree.children.length,
      },
    });

    // Edge from parent → child
    if (tree.node.parentId) {
      const edgeActive =
        activeLineage.has(tree.node.id) &&
        activeLineage.has(tree.node.parentId);

      rfEdges.push({
        id: `${tree.node.parentId}->${tree.node.id}`,
        source: tree.node.parentId,
        target: tree.node.id,
        type: "smoothstep",
        animated: edgeActive,
        style: {
          stroke: edgeActive ? "#3b82f6" : "#525252",
          strokeWidth: edgeActive ? 2 : 1,
        },
      });
    }

    for (const child of tree.children) {
      flatten(child);
    }
  }

  // Process all roots
  const trees = roots.map((r) => buildTree(r, 0));
  let offset = 0;
  for (const tree of trees) {
    computeWidth(tree);
    positionX(tree, offset);
    flatten(tree);
    offset += tree.width + H_GAP * 2;
  }

  return { rfNodes, rfEdges };
}
