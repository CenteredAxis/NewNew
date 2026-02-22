import { useState, useCallback, useMemo } from "react";
import { useChat } from "./hooks/useChat";
import { useModels } from "./hooks/useModels";
import { loadModules } from "./lib/moduleLoader";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { Settings } from "./components/Settings";
import type { ModuleDispatch } from "./types/module";

// Modules are discovered at build time via Vite glob
const MODULES = loadModules();

const DEFAULT_ENDPOINT = "http://localhost:11434";

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (v: T) => {
      setValue(v);
      localStorage.setItem(key, JSON.stringify(v));
    },
    [key]
  );

  return [value, set] as const;
}

export default function App() {
  const [endpointUrl, setEndpointUrl] = useLocalStorage(
    "llm:endpoint",
    DEFAULT_ENDPOINT
  );
  const [apiKey, setApiKey] = useLocalStorage("llm:apiKey", "");
  const [selectedModel, setSelectedModel] = useLocalStorage(
    "llm:model",
    ""
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const apiConfig = useMemo(
    () => ({ endpointUrl, apiKey }),
    [endpointUrl, apiKey]
  );

  const { models, loading: modelsLoading, refresh: refreshModels } = useModels(apiConfig);

  const {
    conversations,
    activeConversation,
    streaming,
    sendMessage,
    stopStreaming,
    createConversation,
    selectConversation,
    deleteConversation,
  } = useChat(selectedModel || models[0] || "", apiConfig);

  // Keep selectedModel in sync when models load for the first time
  const effectiveModel = selectedModel || models[0] || "";

  const handleModelChange = useCallback(
    (m: string) => {
      setSelectedModel(m);
    },
    [setSelectedModel]
  );

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, effectiveModel);
    },
    [sendMessage, effectiveModel]
  );

  const dispatch: ModuleDispatch = useCallback(
    (action) => {
      switch (action.type) {
        case "SET_MODEL":
          setSelectedModel(action.model);
          break;
        case "NEW_CONVERSATION":
          createConversation(effectiveModel);
          break;
        case "SELECT_CONVERSATION":
          selectConversation(action.id);
          break;
        case "DELETE_CONVERSATION":
          deleteConversation(action.id);
          break;
      }
    },
    [
      setSelectedModel,
      createConversation,
      selectConversation,
      deleteConversation,
      effectiveModel,
    ]
  );

  const slotProps = useMemo(
    () => ({
      conversations,
      activeConversation,
      models,
      selectedModel: effectiveModel,
      dispatch,
    }),
    [conversations, activeConversation, models, effectiveModel, dispatch]
  );

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeConversation?.id ?? null}
        onNew={() => createConversation(effectiveModel)}
        onSelect={selectConversation}
        onDelete={deleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        modules={MODULES}
        slotProps={slotProps}
      />

      <ChatWindow
        conversation={activeConversation}
        streaming={streaming}
        models={models}
        modelsLoading={modelsLoading}
        selectedModel={effectiveModel}
        onModelChange={handleModelChange}
        onModelsRefresh={refreshModels}
        onSend={handleSend}
        onStop={stopStreaming}
        modules={MODULES}
        slotProps={slotProps}
      />

      {settingsOpen && (
        <Settings
          endpointUrl={endpointUrl}
          apiKey={apiKey}
          onEndpointUrlChange={setEndpointUrl}
          onApiKeyChange={setApiKey}
          onClose={() => setSettingsOpen(false)}
          modules={MODULES}
          slotProps={slotProps}
        />
      )}
    </div>
  );
}
