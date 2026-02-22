import type { ChatCompletionRequest, StreamChunk, Role } from "../types/chat";

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

export async function fetchModels(config: ApiConfig): Promise<string[]> {
  const res = await fetch(`${API_BASE}/models`, {
    headers: endpointHeaders(config),
  });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
  const data = await res.json();
  return (data.models as { id: string }[]).map((m) => m.id);
}

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

/** Convenience re-export so components only import from lib/api */
export type { Role };
