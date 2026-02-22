interface ModelSelectorProps {
  models: string[];
  selected: string;
  loading: boolean;
  onChange: (model: string) => void;
  onRefresh: () => void;
}

export function ModelSelector({
  models,
  selected,
  loading,
  onChange,
  onRefresh,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || models.length === 0}
        className="bg-neutral-800 text-neutral-100 text-sm rounded px-2 py-1.5 border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {models.length === 0 && (
          <option value="">
            {loading ? "Loading…" : "No models found"}
          </option>
        )}
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <button
        onClick={onRefresh}
        disabled={loading}
        title="Refresh models"
        className="p-1.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
      >
        <RefreshIcon className={loading ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
