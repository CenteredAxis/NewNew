import type { ModuleManifest, SlotProps } from "../types/module";
import { SlotRenderer } from "./SlotRenderer";

interface SettingsProps {
  endpointUrl: string;
  apiKey: string;
  onEndpointUrlChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onClose: () => void;
  modules: ModuleManifest[];
  slotProps: SlotProps;
}

export function Settings({
  endpointUrl,
  apiKey,
  onEndpointUrlChange,
  onApiKeyChange,
  onClose,
  modules,
  slotProps,
}: SettingsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-700">
          <h2 className="text-neutral-100 font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Endpoint */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-300">
              LLM Endpoint URL
            </label>
            <input
              type="url"
              value={endpointUrl}
              onChange={(e) => onEndpointUrlChange(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-neutral-500">
              Base URL of your OpenAI-compatible local LLM (e.g. Ollama, LM
              Studio).
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-300">
              API Key{" "}
              <span className="text-neutral-500 font-normal">(optional)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="Leave blank if not required"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Module settings slots */}
          <SlotRenderer
            modules={modules}
            slot="settingsPanel"
            props={slotProps}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-4 border-t border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
