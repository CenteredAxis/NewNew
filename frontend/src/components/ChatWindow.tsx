import { useState } from "react";
import type { Conversation } from "../types/chat";
import type { ModuleManifest, SlotProps } from "../types/module";
import { MessageList } from "./MessageList";
import { CanvasView } from "./CanvasView";
import { MessageInput } from "./MessageInput";
import { ModelSelector } from "./ModelSelector";
import { SlotRenderer } from "./SlotRenderer";

interface ChatWindowProps {
  conversation: Conversation | null;
  streaming: boolean;
  models: string[];
  modelsLoading: boolean;
  selectedModel: string;
  onModelChange: (m: string) => void;
  onModelsRefresh: () => void;
  onSend: (content: string) => void;
  onStop: () => void;
  modules: ModuleManifest[];
  slotProps: SlotProps;
}

export function ChatWindow({
  conversation,
  streaming,
  models,
  modelsLoading,
  selectedModel,
  onModelChange,
  onModelsRefresh,
  onSend,
  onStop,
  modules,
  slotProps,
}: ChatWindowProps) {
  const [viewMode, setViewMode] = useState<"list" | "canvas">("list");

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-700 shrink-0">
        <ModelSelector
          models={models}
          selected={selectedModel}
          loading={modelsLoading}
          onChange={onModelChange}
          onRefresh={onModelsRefresh}
        />

        {/* Toolbar right side */}
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <button
            onClick={() => setViewMode((m) => (m === "list" ? "canvas" : "list"))}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors"
            title={viewMode === "list" ? "Switch to canvas view" : "Switch to list view"}
          >
            {viewMode === "list" ? (
              // Grid / canvas icon
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            ) : (
              // List icon
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          <SlotRenderer modules={modules} slot="toolbar" props={slotProps} />
        </div>
      </header>

      {/* Messages + overlay wrapper */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {viewMode === "list" ? (
          <MessageList
            messages={conversation?.messages ?? []}
            streaming={streaming}
            modules={modules}
            slotProps={slotProps}
          />
        ) : (
          <CanvasView
            messages={conversation?.messages ?? []}
            streaming={streaming}
            conversationId={conversation?.id ?? null}
          />
        )}

        {/* Module chatOverlay slot */}
        <SlotRenderer modules={modules} slot="chatOverlay" props={slotProps} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={onSend}
        onStop={onStop}
        streaming={streaming}
        disabled={false}
      />
    </div>
  );
}
