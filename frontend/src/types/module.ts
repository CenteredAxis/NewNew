import type { GraphNode, Conversation } from "./chat";

/**
 * Props passed to every module slot component.
 * Modules receive read access to app state and a dispatch function
 * for the small set of actions the core app exposes.
 */
export interface SlotProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  models: string[];
  selectedModel: string;
  dispatch: ModuleDispatch;
}

export interface MessageSlotProps extends SlotProps {
  message: GraphNode;
}

export type ModuleAction =
  | { type: "SET_MODEL"; model: string }
  | { type: "NEW_CONVERSATION" }
  | { type: "SELECT_CONVERSATION"; id: string }
  | { type: "DELETE_CONVERSATION"; id: string };

export type ModuleDispatch = (action: ModuleAction) => void;

/**
 * A module declares which UI slots it occupies.
 * Drop a .tsx file exporting a default ModuleManifest into
 * frontend/src/modules/ and it will be auto-loaded.
 */
export interface ModuleManifest {
  /** Unique identifier, e.g. "chat-branching" */
  id: string;
  /** Display name */
  name: string;
  version: string;
  /** Optional: backend module name to verify is loaded */
  backendModule?: string;
  slots?: Partial<{
    /** Rendered inside the left sidebar, below core nav */
    sidebar: React.FC<SlotProps>;
    /** Rendered in the top toolbar, right side */
    toolbar: React.FC<SlotProps>;
    /** Rendered below each message bubble */
    messageActions: React.FC<MessageSlotProps>;
    /** Rendered as a section inside the Settings panel */
    settingsPanel: React.FC<SlotProps>;
    /** Rendered as an overlay on top of the chat area */
    chatOverlay: React.FC<SlotProps>;
  }>;
}
