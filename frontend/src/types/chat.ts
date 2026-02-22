export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: number;
  updatedAt: number;
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
