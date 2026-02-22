export type Role = "user" | "assistant" | "system";

/**
 * DAG Node — replaces the old linear Message type.
 * Each node has a parent_id forming a tree/DAG structure.
 */
export type NodeStatus = "idle" | "executing" | "complete" | "error";

export interface GraphNode {
  id: string;
  conversationId: string;
  parentId: string | null;
  content: string;
  role: Role;
  nodeType: string;
  tokenCount: number;
  metadata: {
    x?: number;
    y?: number;
    status?: NodeStatus;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
    lastExecutedAt?: string;
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Conversation — top-level grouping.
 * No longer contains a messages[] array; nodes are fetched separately via the tree API.
 */
export interface Conversation {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

/** Legacy Message type — kept for backward compat during migration */
export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: { role: Role; content: string }[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface StreamChunk {
  id: string;
  object: string;
  choices: {
    delta: { role?: Role; content?: string };
    finish_reason: string | null;
    index: number;
  }[];
}
