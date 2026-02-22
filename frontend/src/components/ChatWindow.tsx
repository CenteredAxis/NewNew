import type { Conversation } from "../types/chat";
import type { ModuleManifest, SlotProps } from "../types/module";
import { MessageList } from "./MessageList";
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

        {/* Module toolbar slot */}
        <div className="flex items-center gap-2">
          <SlotRenderer modules={modules} slot="toolbar" props={slotProps} />
        </div>
      </header>

      {/* Messages + overlay wrapper */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <MessageList
          messages={conversation?.messages ?? []}
          streaming={streaming}
          modules={modules}
          slotProps={slotProps}
        />

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
