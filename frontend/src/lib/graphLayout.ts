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
 *
 * Nodes are split into two categories:
 *   - "free" nodes: have both metadata.x and metadata.y set (user-positioned)
 *   - "tree" nodes: no metadata position — placed by the auto tree layout
 *
 * Free nodes are excluded from the tree algorithm so they don't affect
 * sibling positions. They are added at their stored coordinates after the
 * tree layout runs. All parent→child edges are rendered regardless.
 */
export function graphToReactFlow(
  nodes: GraphNode[],
  activeNodeId: string | null
): { rfNodes: RFNode[]; rfEdges: RFEdge[] } {
  if (nodes.length === 0) return { rfNodes: [], rfEdges: [] };

  // Split into free-positioned and tree-layout nodes
  const freeNodes = nodes.filter(
    (n) => n.metadata?.x != null && n.metadata?.y != null
  );
  const freeNodeIds = new Set(freeNodes.map((n) => n.id));

  // Build a full node map for lineage and child lookups
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Build parent → children map (tree nodes only, so free nodes don't
  // participate in width computation or positioning)
  const childrenMap = new Map<string | null, GraphNode[]>();
  for (const n of nodes) {
    if (freeNodeIds.has(n.id)) continue;
    const parentKey = n.parentId;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(n);
  }

  // Find roots (tree nodes with null parentId)
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

  const rfNodes: RFNode[] = [];
  const rfEdges: RFEdge[] = [];

  // Helper: emit an edge from parent → child
  function addEdge(node: GraphNode): void {
    if (!node.parentId) return;
    const edgeActive =
      activeLineage.has(node.id) && activeLineage.has(node.parentId);
    rfEdges.push({
      id: `${node.parentId}->${node.id}`,
      source: node.parentId,
      target: node.id,
      type: "smoothstep",
      animated: edgeActive,
      style: {
        stroke: edgeActive ? "#3b82f6" : "#525252",
        strokeWidth: edgeActive ? 2 : 1,
      },
    });
  }

  // Flatten tree into ReactFlow nodes + edges
  function flatten(tree: TreeNode): void {
    const isActive = activeLineage.has(tree.node.id);
    const isActiveNode = tree.node.id === activeNodeId;

    rfNodes.push({
      id: tree.node.id,
      type: "graphNode",
      position: { x: tree.x, y: tree.y },
      data: {
        node: tree.node,
        isActive,
        isActiveNode,
        hasChildren: tree.children.length > 0,
        childCount: tree.children.length,
      },
    });

    addEdge(tree.node);

    for (const child of tree.children) {
      flatten(child);
    }
  }

  // Process all tree roots
  const trees = roots.map((r) => buildTree(r, 0));
  let offset = 0;
  for (const tree of trees) {
    computeWidth(tree);
    positionX(tree, offset);
    flatten(tree);
    offset += tree.width + H_GAP * 2;
  }

  // Add free-positioned nodes at their stored coordinates
  for (const n of freeNodes) {
    const isActive = activeLineage.has(n.id);
    const isActiveNode = n.id === activeNodeId;
    const childCount = nodes.filter((node) => node.parentId === n.id).length;

    rfNodes.push({
      id: n.id,
      type: "graphNode",
      position: {
        x: n.metadata!.x as number,
        y: n.metadata!.y as number,
      },
      data: {
        node: n,
        isActive,
        isActiveNode,
        hasChildren: childCount > 0,
        childCount,
      },
    });

    addEdge(n);
  }

  return { rfNodes, rfEdges };
}
