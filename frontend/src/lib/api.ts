import type {
  ChatCompletionRequest,
  StreamChunk,
  Role,
  Conversation,
  GraphNode,
} from "../types/chat";

const API_BASE = "/api";

export interface ApiConfig {
  endpointUrl: string;
  apiKey?: string;
}

function endpointHeaders(config: ApiConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "x-endpoint-url": config.endpointUrl,
  };
  if (config.apiKey) headers["x-api-key"] = config.apiKey;
  return headers;
}

// ── Model discovery ──────────────────────────────────────────────

export async function fetchModels(config: ApiConfig): Promise<string[]> {
  const res = await fetch(`${API_BASE}/models`, {
    headers: endpointHeaders(config),
  });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
  const data = await res.json();
  return (data.models as { id: string }[]).map((m) => m.id);
}

// ── Legacy streaming (kept for backward compat) ──────────────────

export async function* streamChat(
  req: ChatCompletionRequest,
  config: ApiConfig,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...endpointHeaders(config),
    },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat request failed: ${err}`);
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const chunk: StreamChunk = JSON.parse(data);
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) yield delta.content;
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

// ── DAG API: Conversations ───────────────────────────────────────

export async function apiCreateConversation(
  model: string,
  config: ApiConfig
): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...endpointHeaders(config),
    },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error(`Failed to create conversation: ${res.statusText}`);
  return res.json();
}

export async function apiListConversations(
  config: ApiConfig
): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/conversations`, {
    headers: endpointHeaders(config),
  });
  if (!res.ok) throw new Error(`Failed to list conversations: ${res.statusText}`);
  return res.json();
}

export async function apiDeleteConversation(
  id: string,
  config: ApiConfig
): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    method: "DELETE",
    headers: endpointHeaders(config),
  });
  if (!res.ok) throw new Error(`Failed to delete conversation: ${res.statusText}`);
}

// ── DAG API: Nodes ───────────────────────────────────────────────

export async function apiGetTree(
  convId: string,
  config: ApiConfig
): Promise<GraphNode[]> {
  const res = await fetch(`${API_BASE}/conversations/${convId}/tree`, {
    headers: endpointHeaders(config),
  });
  if (!res.ok) throw new Error(`Failed to get tree: ${res.statusText}`);
  const data = await res.json();
  return data.nodes;
}

export interface CreateNodeReq {
  parentId: string | null;
  content: string;
  role: string;
  metadata?: Record<string, unknown>;
}

export async function apiCreateNode(
  convId: string,
  req: CreateNodeReq,
  config: ApiConfig
): Promise<GraphNode> {
  const res = await fetch(`${API_BASE}/conversations/${convId}/nodes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...endpointHeaders(config),
    },
    body: JSON.stringify({
      parent_id: req.parentId,
      content: req.content,
      role: req.role,
      metadata: req.metadata ?? {},
    }),
  });
  if (!res.ok) throw new Error(`Failed to create node: ${res.statusText}`);
  return res.json();
}

export async function apiUpdateNodeMetadata(
  convId: string,
  nodeId: string,
  metadata: Record<string, unknown>,
  config: ApiConfig
): Promise<GraphNode> {
  const res = await fetch(
    `${API_BASE}/conversations/${convId}/nodes/${nodeId}/metadata`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...endpointHeaders(config),
      },
      body: JSON.stringify({ metadata }),
    }
  );
  if (!res.ok) throw new Error(`Failed to update metadata: ${res.statusText}`);
  return res.json();
}

// ── DAG API: Streaming completion ────────────────────────────────

export interface CompleteReq {
  parentId: string;
  model: string;
  maxContextTokens?: number;
}

/**
 * Stream a DAG-aware completion. The backend:
 * 1. Walks the DAG from parentId to root to assemble context
 * 2. Creates an assistant node
 * 3. Streams the LLM response
 *
 * Yields events: { nodeId } (first event) and { chunk } (content deltas).
 */
export async function* streamComplete(
  convId: string,
  req: CompleteReq,
  config: ApiConfig,
  signal?: AbortSignal
): AsyncGenerator<{ nodeId?: string; chunk?: string }> {
  const res = await fetch(`${API_BASE}/conversations/${convId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...endpointHeaders(config),
    },
    body: JSON.stringify({
      parent_id: req.parentId,
      model: req.model,
      max_context_tokens: req.maxContextTokens ?? 100_000,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Completion failed: ${err}`);
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);

        // First event from our backend: assistant node ID
        if (parsed.nodeId) {
          yield { nodeId: parsed.nodeId };
          continue;
        }

        // Standard OpenAI streaming chunk
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.content) {
          yield { chunk: delta.content };
        }
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

// ── Misc ─────────────────────────────────────────────────────────

export async function fetchLoadedBackendModules(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/modules`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.modules as string[];
  } catch {
    return [];
  }
}

export type { Role };
