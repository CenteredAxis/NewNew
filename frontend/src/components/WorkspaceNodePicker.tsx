import { useEffect, useRef } from "react";
import { getRegisteredNodeTypes } from "../lib/nodeRenderers";

interface WorkspaceNodePickerProps {
  screenX: number;
  screenY: number;
  onSelect: (nodeType: string) => void;
  onDismiss: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  message: "Text note",
  code: "Code block",
  fetch: "URL fetch",
};

export function WorkspaceNodePicker({
  screenX,
  screenY,
  onSelect,
  onDismiss,
}: WorkspaceNodePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  // All available types: built-in "message" + any registered dynamic types
  const types = ["message", ...getRegisteredNodeTypes()];

  // Dismiss on click outside (delayed to avoid catching the double-click that opened it)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onDismiss]);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onDismiss]);

  // Keep picker inside viewport
  const rowHeight = 32;
  const headerHeight = 28;
  const pickerHeight = headerHeight + types.length * rowHeight + 8;
  const pickerWidth = 152;
  const left = Math.min(screenX, window.innerWidth - pickerWidth - 8);
  const top = Math.min(screenY, window.innerHeight - pickerHeight - 8);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, zIndex: 1000 }}
      className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-2xl p-1.5 min-w-[152px]"
    >
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider px-2 py-1.5 select-none">
        Add node
      </p>
      {types.map((type) => (
        <button
          key={type}
          className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-neutral-700 text-neutral-300 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(type);
          }}
        >
          {TYPE_LABELS[type] ?? type}
        </button>
      ))}
    </div>
  );
}
