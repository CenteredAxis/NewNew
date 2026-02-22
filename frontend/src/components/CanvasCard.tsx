import { useRef } from "react";
import type { Message } from "../types/chat";
import type { Position } from "../hooks/useCanvasPositions";

interface CanvasCardProps {
  message: Message;
  position: Position;
  zoom: number;
  isLast: boolean;
  streaming: boolean;
  expanded: boolean;
  onDragEnd: (id: string, pos: Position) => void;
  onToggleExpand: (id: string) => void;
}

export function CanvasCard({
  message,
  position,
  zoom,
  isLast,
  streaming,
  expanded,
  onDragEnd,
  onToggleExpand,
}: CanvasCardProps) {
  const isUser = message.role === "user";
  const showCursor = isLast && !isUser && streaming;

  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    // Only primary button or touch
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.stopPropagation();

    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    cardRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const ds = dragState.current;
    if (!ds || ds.pointerId !== e.pointerId) return;

    const dx = (e.clientX - ds.startX) / zoom;
    const dy = (e.clientY - ds.startY) / zoom;

    if (!ds.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    ds.moved = true;

    // Update card position via CSS directly for smooth drag (no React re-render per frame)
    if (cardRef.current) {
      cardRef.current.style.left = `${ds.originX + dx}px`;
      cardRef.current.style.top = `${ds.originY + dy}px`;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const ds = dragState.current;
    if (!ds || ds.pointerId !== e.pointerId) return;

    if (ds.moved) {
      const dx = (e.clientX - ds.startX) / zoom;
      const dy = (e.clientY - ds.startY) / zoom;
      onDragEnd(message.id, { x: ds.originX + dx, y: ds.originY + dy });
    }

    dragState.current = null;
  }

  function onHeaderDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleExpand(message.id);
  }

  const roleLabel = isUser ? "You" : "Assistant";
  const roleDot = isUser ? "bg-blue-500" : "bg-neutral-500";
  const borderAccent = isUser ? "border-l-blue-500" : "border-l-neutral-600";

  return (
    <div
      ref={cardRef}
      style={{ left: position.x, top: position.y }}
      className="absolute select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={`
          bg-neutral-900 border border-neutral-700 border-l-2 ${borderAccent}
          rounded-xl shadow-lg shadow-black/40
          ${expanded ? "w-[480px]" : "w-[280px]"}
          transition-[width] duration-150
        `}
      >
        {/* Drag handle header */}
        <div
          onPointerDown={onPointerDown}
          onDoubleClick={onHeaderDoubleClick}
          className="flex items-center gap-2 px-3 h-8 cursor-grab active:cursor-grabbing border-b border-neutral-800 rounded-t-xl select-none"
          title="Drag to move · Double-click to expand"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${roleDot}`} />
          <span className="text-xs text-neutral-400 font-medium truncate flex-1">
            {roleLabel}
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleExpand(message.id); }}
            className="text-neutral-600 hover:text-neutral-300 transition-colors ml-auto"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 7h8M2 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4h8M2 8h8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>

        {/* Content */}
        <div
          className={`
            px-3 py-2.5 text-sm text-neutral-100 whitespace-pre-wrap break-words overflow-hidden
            ${expanded ? "" : "max-h-[120px]"}
          `}
        >
          {message.content || (showCursor ? "" : <span className="text-neutral-600 italic">...</span>)}
          {showCursor && (
            <span className="inline-block w-0.5 h-4 bg-neutral-400 ml-0.5 align-middle animate-pulse" />
          )}
        </div>

        {/* Fade gradient when collapsed and content overflows */}
        {!expanded && (
          <div className="h-4 bg-gradient-to-t from-neutral-900 to-transparent -mt-4 rounded-b-xl pointer-events-none relative" />
        )}
      </div>
    </div>
  );
}
