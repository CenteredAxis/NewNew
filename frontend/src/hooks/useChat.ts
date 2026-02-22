// @ts-nocheck — Deprecated: replaced by useGraph.ts (DAG-based state management)
import { useState, useCallback, useRef } from "react";
import { streamChat, type ApiConfig } from "../lib/api";
import type { Conversation, Message } from "../types/chat";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newConversation(model: string): Conversation {
  const now = Date.now();
  return {
    id: generateId(),
    title: "New conversation",
    messages: [],
    model,
    createdAt: now,
    updatedAt: now,
  };
}

export function useChat(initialModel: string, config: ApiConfig) {
  const [conversations, setConversations] = useState<Conversation[]>(() => [
    newConversation(initialModel),
  ]);
  const [activeId, setActiveId] = useState<string | null>(
    () => conversations[0]?.id ?? null
  );
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updater(c) : c))
      );
    },
    []
  );

  const createConversation = useCallback(
    (model: string) => {
      const c = newConversation(model);
      setConversations((prev) => [c, ...prev]);
      setActiveId(c.id);
      return c;
    },
    []
  );

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
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

  // keep a ref so sendMessage always sees the latest config without re-creating
  const configRef = useRef(config);
  configRef.current = config;

  const sendMessage = useCallback(
    async (content: string, model: string) => {
      let target = activeConversation;
      if (!target) {
        target = newConversation(model);
        setConversations((prev) => [target!, ...prev]);
        setActiveId(target.id);
      }

      const convId = target.id;

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content,
        createdAt: Date.now(),
      };

      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      updateConversation(convId, (c) => ({
        ...c,
        messages: [...c.messages, userMsg, assistantMsg],
        title:
          c.messages.length === 0
            ? content.slice(0, 60) || "New conversation"
            : c.title,
        updatedAt: Date.now(),
      }));

      setStreaming(true);
      abortRef.current = new AbortController();

      try {
        const history = [
          ...target.messages,
          { role: userMsg.role, content: userMsg.content },
        ];

        for await (const chunk of streamChat(
          { model, messages: history, stream: true },
          configRef.current,
          abortRef.current.signal
        )) {
          updateConversation(convId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + chunk }
                : m
            ),
          }));
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          updateConversation(convId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: `[Error: ${(e as Error).message}]` }
                : m
            ),
          }));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeConversation, updateConversation]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    conversations,
    activeConversation,
    streaming,
    sendMessage,
    stopStreaming,
    createConversation,
    selectConversation,
    deleteConversation,
  };
}
