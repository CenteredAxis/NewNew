import { useState, useCallback, useEffect, useRef } from "react";
import type { Message } from "../types/chat";

export interface Position {
  x: number;
  y: number;
}

type PositionMap = Record<string, Position>;

function autoPosition(messages: Message[]): PositionMap {
  const map: PositionMap = {};
  messages.forEach((msg, i) => {
    map[msg.id] = {
      x: msg.role === "user" ? 80 : 380,
      y: 60 + i * 210,
    };
  });
  return map;
}

function loadPositions(conversationId: string): PositionMap | null {
  try {
    const raw = localStorage.getItem(`canvas:${conversationId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePositions(conversationId: string, positions: PositionMap) {
  try {
    localStorage.setItem(`canvas:${conversationId}`, JSON.stringify(positions));
  } catch {
    // localStorage quota — silently ignore
  }
}

export function useCanvasPositions(
  conversationId: string | null,
  messages: Message[]
) {
  const [positions, setPositions] = useState<PositionMap>({});
  const [pan, setPan] = useState<Position>({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
  const prevConvId = useRef<string | null>(null);

  // When conversation changes, load/build positions and reset pan/zoom
  useEffect(() => {
    if (conversationId === prevConvId.current) return;
    prevConvId.current = conversationId;

    if (!conversationId || messages.length === 0) {
      setPositions({});
      setPan({ x: 80, y: 80 });
      setZoom(1);
      return;
    }

    const saved = loadPositions(conversationId);
    const auto = autoPosition(messages);

    if (saved) {
      // Merge: use saved positions, fall back to auto for any new messages
      const merged: PositionMap = { ...auto, ...saved };
      setPositions(merged);
    } else {
      setPositions(auto);
    }

    setPan({ x: 80, y: 80 });
    setZoom(1);
  }, [conversationId, messages]);

  // Auto-position new messages that arrive (streaming adds a new message id)
  useEffect(() => {
    if (!conversationId) return;
    setPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      messages.forEach((msg, i) => {
        if (!next[msg.id]) {
          next[msg.id] = { x: msg.role === "user" ? 80 : 380, y: 60 + i * 210 };
          changed = true;
        }
      });
      if (changed && conversationId) {
        savePositions(conversationId, next);
      }
      return changed ? next : prev;
    });
  }, [conversationId, messages]);

  const setPosition = useCallback(
    (id: string, pos: Position) => {
      setPositions((prev) => {
        const next = { ...prev, [id]: pos };
        if (conversationId) savePositions(conversationId, next);
        return next;
      });
    },
    [conversationId]
  );

  const resetLayout = useCallback(
    (msgs: Message[]) => {
      const fresh = autoPosition(msgs);
      setPositions(fresh);
      setPan({ x: 80, y: 80 });
      setZoom(1);
      if (conversationId) savePositions(conversationId, fresh);
    },
    [conversationId]
  );

  const resetView = useCallback(() => {
    setPan({ x: 80, y: 80 });
    setZoom(1);
  }, []);

  return {
    positions,
    pan,
    zoom,
    setPosition,
    setPan,
    setZoom,
    resetLayout,
    resetView,
  };
}
