import { useEffect } from "react";
import type { GraphNode } from "../types/chat";

/**
 * Polls refreshable nodes at their configured intervals.
 * A node is refreshable when metadata.autoRefresh === true
 * and metadata.refreshIntervalMs is set.
 */
export function useAutoRefresh(
  nodes: GraphNode[],
  refreshNode: (nodeId: string) => Promise<unknown>
): void {
  useEffect(() => {
    const refreshable = nodes.filter(
      (n) =>
        n.metadata?.autoRefresh &&
        n.metadata?.refreshIntervalMs &&
        n.metadata?.status !== "executing"
    );
    if (refreshable.length === 0) return;

    const intervals = refreshable.map((n) =>
      setInterval(
        () => void refreshNode(n.id),
        n.metadata.refreshIntervalMs as number
      )
    );

    return () => intervals.forEach(clearInterval);
  }, [nodes, refreshNode]);
}
