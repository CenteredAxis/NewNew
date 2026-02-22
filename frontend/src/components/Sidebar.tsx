import type { Conversation } from "../types/chat";
import type { ModuleManifest, SlotProps } from "../types/module";
import { SlotRenderer } from "./SlotRenderer";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  modules: ModuleManifest[];
  slotProps: SlotProps;
}

export function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  onOpenSettings,
  modules,
  slotProps,
}: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-neutral-900 border-r border-neutral-700 h-full">
      {/* New chat button */}
      <div className="p-3 border-b border-neutral-700">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-sm font-medium transition-colors"
        >
          <PlusIcon />
          New conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            active={c.id === activeId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Module sidebar slot */}
      <div className="border-t border-neutral-700">
        <SlotRenderer modules={modules} slot="sidebar" props={slotProps} />
      </div>

      {/* Settings button */}
      <div className="p-3 border-t border-neutral-700">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-neutral-100 text-sm transition-colors"
        >
          <GearIcon />
          Settings
        </button>
      </div>
    </aside>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function ConversationItem({
  conversation,
  active,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer ${
        active
          ? "bg-neutral-700 text-neutral-100"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
      }`}
      onClick={() => onSelect(conversation.id)}
    >
      <span className="flex-1 text-sm truncate">{conversation.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(conversation.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-opacity"
        title="Delete"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
