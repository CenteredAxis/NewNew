import { useRef, useCallback, useState, useEffect } from "react";
import type { Message } from "../types/chat";
import { useCanvasPositions, type Position } from "../hooks/useCanvasPositions";
import { CanvasCard } from "./CanvasCard";

interface CanvasViewProps {
  messages: Message[];
  streaming: boolean;
  conversationId: string | null;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

export function CanvasView({ messages, streaming, conversationId }: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { positions, pan, zoom, setPosition, setPan, setZoom, resetView, resetLayout } =
    useCanvasPositions(conversationId, messages);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Clear expanded state when conversation changes
  useEffect(() => {
    setExpandedIds(new Set());
  }, [conversationId]);

  // Pan state
  const panState = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // Only start pan if clicking directly on the canvas (not a card)
    const target = e.target as HTMLElement;
    if (target.closest("[data-canvas-card]")) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    panState.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    containerRef.current?.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
  }, []);

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const ps = panState.current;
    if (!ps || ps.pointerId !== e.pointerId) return;

    const dx = e.clientX - ps.lastX;
    const dy = e.clientY - ps.lastY;
    ps.lastX = e.clientX;
    ps.lastY = e.clientY;

    setPan((prev: Position) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [setPan]);

  const onCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (!panState.current || panState.current.pointerId !== e.pointerId) return;
    panState.current = null;
    e.currentTarget.style.cursor = "";
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.pow(0.999, e.deltaY);
      const newZoom = clamp(zoom * factor, 0.2, 2.5);

      setPan((prev: Position) => ({
        x: mx - (mx - prev.x) * (newZoom / zoom),
        y: my - (my - prev.y) * (newZoom / zoom),
      }));
      setZoom(newZoom);
    },
    [zoom, setPan, setZoom]
  );

  const handleDragEnd = useCallback(
    (id: string, pos: Position) => {
      setPosition(id, pos);
    },
    [setPosition]
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Grid background that tracks pan and zoom
  const gridStyle: React.CSSProperties = {
    backgroundImage: "radial-gradient(circle, #404040 1px, transparent 1px)",
    backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
    backgroundPosition: `${pan.x}px ${pan.y}px`,
  };

  const transformStyle: React.CSSProperties = {
    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
    transformOrigin: "0 0",
    position: "absolute",
    inset: 0,
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500 select-none">
        Start a conversation
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none" style={gridStyle} />

      {/* Canvas surface */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onWheel={onWheel}
      >
        {/* Transform container */}
        <div style={transformStyle}>
          {messages.map((msg, i) => {
            const pos = positions[msg.id];
            if (!pos) return null;
            return (
              <div key={msg.id} data-canvas-card>
                <CanvasCard
                  message={msg}
                  position={pos}
                  zoom={zoom}
                  isLast={i === messages.length - 1}
                  streaming={streaming}
                  expanded={expandedIds.has(msg.id)}
                  onDragEnd={handleDragEnd}
                  onToggleExpand={handleToggleExpand}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* HUD controls — fixed over canvas */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
        <button
          onClick={() => resetLayout(messages)}
          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-100 bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 rounded-lg backdrop-blur-sm transition-colors"
          title="Reset card layout"
        >
          Reset layout
        </button>
        <button
          onClick={resetView}
          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-100 bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 rounded-lg backdrop-blur-sm transition-colors"
          title="Reset pan and zoom"
        >
          Home
        </button>
        <span className="text-xs text-neutral-600 w-10 text-right tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
