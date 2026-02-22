import { useState, useCallback, useRef, useEffect } from "react";
import {
  apiCreateConversation,
  apiListConversations,
  apiDeleteConversation,
  apiGetTree,
  apiCreateNode,
  apiExecuteNode,
  apiRefreshNode,
  apiUpdateNode,
  streamComplete,
  type ApiConfig,
} from "../lib/api";
import type { Conversation, GraphNode } from "../types/chat";

/**
 * DAG-aware conversation state management.
 * Replaces useChat — all data is server-persisted in PostgreSQL.
 *
 * Key concepts:
 * - `nodes` = full tree of GraphNode[] for the active conversation
 * - `activeNodeId` = the "cursor" — the leaf node the user is currently at
 * - Sending a message creates a user node as child of activeNodeId, then streams completion
 * - Forking = sending a message from a non-leaf node (same API, different parentId)
 */
export function useGraph(config: ApiConfig) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  // Load conversation list on mount
  useEffect(() => {
    apiListConversations(configRef.current)
      .then((convs) => {
        setConversations(convs);
        if (convs.length > 0 && !activeId) {
          setActiveId(convs[0].id);
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tree when active conversation changes
  useEffect(() => {
    if (!activeId) {
      setNodes([]);
      setActiveNodeId(null);
      return;
    }

    apiGetTree(activeId, configRef.current)
      .then((treeNodes) => {
        setNodes(treeNodes);
        // Set active node to the latest leaf (deepest node with no children)
        if (treeNodes.length > 0) {
          const childSet = new Set(
            treeNodes.filter((n) => n.parentId).map((n) => n.parentId)
          );
          const leaves = treeNodes.filter((n) => !childSet.has(n.id));
          // Pick the most recently created leaf
          const latest = leaves.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          setActiveNodeId(latest?.id ?? null);
        } else {
          setActiveNodeId(null);
        }
      })
      .catch(() => {
        setNodes([]);
        setActiveNodeId(null);
      });
  }, [activeId]);

  // Create a new conversation
  const createConversation = useCallback(
    async (model: string) => {
      const conv = await apiCreateConversation(model, configRef.current);
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setNodes([]);
      setActiveNodeId(null);
      return conv;
    },
    []
  );

  // Select a conversation
  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      await apiDeleteConversation(id, configRef.current);
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(next[0]?.id ?? null);
        }
        return next;
      });
    },
    [activeId]
  );

  // Send a message — creates user node + streams assistant response
  const sendMessage = useCallback(
    async (content: string, model: string, parentId?: string) => {
      let convId = activeId;

      // Auto-create conversation if none exists
      if (!convId) {
        const conv = await apiCreateConversation(model, configRef.current);
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
        convId = conv.id;
      }

      const parent = parentId ?? activeNodeId;

      // 1. Create user node
      const userNode = await apiCreateNode(
        convId,
        { parentId: parent, content, role: "user" },
        configRef.current
      );
      setNodes((prev) => [...prev, userNode]);

      // Update conversation title if first message
      if (nodes.length === 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, title: content.slice(0, 60) || "New conversation" }
              : c
          )
        );
      }

      // 2. Stream completion
      setStreaming(true);
      abortRef.current = new AbortController();

      let assistantNodeId = "";
      let assistantContent = "";

      // Add placeholder assistant node
      const placeholderId = `pending-${Date.now()}`;
      const placeholderNode: GraphNode = {
        id: placeholderId,
        conversationId: convId,
        parentId: userNode.id,
        content: "",
        role: "assistant",
        nodeType: "message",
        tokenCount: 0,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNodes((prev) => [...prev, placeholderNode]);
      setActiveNodeId(placeholderId);

      try {
        for await (const event of streamComplete(
          convId,
          { parentId: userNode.id, model },
          configRef.current,
          abortRef.current.signal
        )) {
          if (event.nodeId) {
            assistantNodeId = event.nodeId;
            // Replace placeholder with real ID
            setNodes((prev) =>
              prev.map((n) =>
                n.id === placeholderId ? { ...n, id: assistantNodeId } : n
              )
            );
            setActiveNodeId(assistantNodeId);
          }
          if (event.chunk) {
            assistantContent += event.chunk;
            const currentId = assistantNodeId || placeholderId;
            setNodes((prev) =>
              prev.map((n) =>
                n.id === currentId ? { ...n, content: assistantContent } : n
              )
            );
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const currentId = assistantNodeId || placeholderId;
          setNodes((prev) =>
            prev.map((n) =>
              n.id === currentId
                ? { ...n, content: `[Error: ${(e as Error).message}]` }
                : n
            )
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeId, activeNodeId, nodes.length]
  );

  // Stop streaming
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Execute a dynamic node via its registered handler
  const executeNode = useCallback(async (nodeId: string) => {
    const updated = await apiExecuteNode(nodeId, configRef.current);
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? updated : n)));
    return updated;
  }, []);

  // Refresh (re-execute) a dynamic node
  const refreshNode = useCallback(async (nodeId: string) => {
    const updated = await apiRefreshNode(nodeId, configRef.current);
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? updated : n)));
    return updated;
  }, []);

  // Move a node to a new position (persists x/y to backend via metadata)
  const moveNode = useCallback(async (nodeId: string, x: number, y: number) => {
    // Optimistic update so layout immediately treats it as a free node
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, metadata: { ...n.metadata, x, y } } : n
      )
    );
    try {
      await apiUpdateNode(nodeId, { metadata: { x, y } }, configRef.current);
    } catch {
      // Position update failure is non-critical; the optimistic state persists
    }
  }, []);

  // Create a free-form workspace node at the given flow coordinates.
  // Pass model so we can auto-create a conversation if none exists yet.
  const createWorkspaceNode = useCallback(
    async (nodeType: string, x: number, y: number, model?: string) => {
      let convId = activeId;
      if (!convId) {
        if (!model) return; // Need a model to auto-create a conversation
        const conv = await apiCreateConversation(model, configRef.current);
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
        convId = conv.id;
      }
      const node = await apiCreateNode(
        convId,
        {
          parentId: activeNodeId,
          content: "",
          role: "workspace",
          nodeType,
          metadata: { x, y, status: "idle", input: {}, output: {} },
        },
        configRef.current
      );
      setNodes((prev) => [...prev, node]);
      setActiveNodeId(node.id);
      return node;
    },
    [activeId, activeNodeId]
  );

  return {
    conversations,
    activeConversation,
    nodes,
    activeNodeId,
    streaming,
    loaded,
    sendMessage,
    stopStreaming,
    createConversation,
    selectConversation,
    deleteConversation,
    setActiveNodeId,
    executeNode,
    refreshNode,
    moveNode,
    createWorkspaceNode,
  };
}

/**
 * Get the lineage from root to a target node (for list view).
 * Walks up from targetId through parentId references.
 */
export function getLineage(
  nodes: GraphNode[],
  targetId: string | null
): GraphNode[] {
  if (!targetId || nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const path: GraphNode[] = [];
  let current = nodeMap.get(targetId);

  while (current) {
    path.unshift(current);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }

  return path;
}
