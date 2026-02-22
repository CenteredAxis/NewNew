import { useEffect, useRef } from "react";
import type { GraphNode } from "../types/chat";
import type { ModuleManifest, SlotProps } from "../types/module";
import { SlotRenderer } from "./SlotRenderer";

interface MessageListProps {
  nodes: GraphNode[];
  streaming: boolean;
  modules: ModuleManifest[];
  slotProps: SlotProps;
}

export function MessageList({
  nodes,
  streaming,
  modules,
  slotProps,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500 select-none">
        Start a conversation
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {nodes.map((node, i) => (
        <MessageBubble
          key={node.id}
          node={node}
          isLast={i === nodes.length - 1}
          streaming={streaming}
          modules={modules}
          slotProps={slotProps}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

interface MessageBubbleProps {
  node: GraphNode;
  isLast: boolean;
  streaming: boolean;
  modules: ModuleManifest[];
  slotProps: SlotProps;
}

function MessageBubble({
  node,
  isLast,
  streaming,
  modules,
  slotProps,
}: MessageBubbleProps) {
  const isUser = node.role === "user";
  const showCursor = isLast && !isUser && streaming;

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-neutral-800 text-neutral-100 rounded-bl-sm"
        }`}
      >
        {node.content}
        {showCursor && (
          <span className="inline-block w-0.5 h-4 bg-neutral-400 ml-0.5 align-middle animate-pulse" />
        )}
      </div>

      {/* Module messageActions slot */}
      <SlotRenderer
        modules={modules}
        slot="messageActions"
        props={{ ...slotProps, message: node }}
      />
    </div>
  );
}
