# Keystone

Minimal, modular web UI for any OpenAI-compatible local LLM endpoint (Ollama, LM Studio, llama.cpp, vLLM, etc.).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 · Vite 6 · TypeScript · Tailwind CSS 3 |
| Backend | Python · FastAPI · httpx · uvicorn |

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Optional: set defaults in .env (see backend/.env.example)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Open the app, click **Settings**, and enter your LLM endpoint URL (e.g. `http://localhost:11434` for Ollama). The frontend proxies all LLM calls through the FastAPI backend.

### Production build

```bash
cd frontend && npm run build   # outputs to frontend/dist/
# Serve dist/ as static files behind the same origin as the FastAPI server,
# or configure CORS / a reverse proxy.
```

---

## Architecture

```
frontend/src/
├── components/       Core UI (ChatWindow, Sidebar, Settings, …)
├── hooks/            useChat · useModels
├── lib/              api.ts (HTTP client) · moduleLoader.ts (Vite glob)
├── modules/          ← drop frontend module .tsx files here
└── types/            chat.ts · module.ts  (shared type contracts)

backend/
├── app/
│   ├── core/         config · llm proxy · module_loader
│   ├── routers/      chat · models
│   └── main.py       FastAPI app + lifespan
└── modules/          ← drop backend module .py files here
```

All LLM traffic flows:

```
Browser  →  POST /api/chat/completions  →  FastAPI proxy  →  Local LLM endpoint
```

The endpoint URL and optional API key are stored in `localStorage` and forwarded as `X-Endpoint-Url` / `X-Api-Key` request headers. The backend reads these and uses its own `.env` values as fallback.

---

## Module system

Modules add capabilities without touching core code. A module can have a frontend part, a backend part, or both.

### Frontend module

Create `frontend/src/modules/my-module.tsx`:

```tsx
import type { ModuleManifest } from "../types/module";

const manifest: ModuleManifest = {
  id: "my-module",
  name: "My Module",
  version: "0.1.0",
  slots: {
    // Any combination of the slots below:
    sidebar:        ({ conversations, dispatch }) => <div>…</div>,
    toolbar:        (props) => <div>…</div>,
    messageActions: ({ message }) => <button>Copy</button>,
    settingsPanel:  (props) => <div>…</div>,
    chatOverlay:    (props) => <div>…</div>,
  },
};

export default manifest;
```

Vite auto-discovers the file on the next hot-reload. No registration required.

#### Available slots

| Slot | Where it renders | Props |
|------|-----------------|-------|
| `sidebar` | Below the conversation list in the sidebar | `SlotProps` |
| `toolbar` | Right side of the top toolbar | `SlotProps` |
| `messageActions` | Below each message bubble | `MessageSlotProps` (includes `message`) |
| `settingsPanel` | Inside the Settings modal | `SlotProps` |
| `chatOverlay` | Absolute overlay on the chat area | `SlotProps` |

All slots receive `SlotProps`:

```ts
interface SlotProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  models: string[];
  selectedModel: string;
  dispatch: ModuleDispatch;   // trigger core actions
}
```

`dispatch` accepts:

```ts
{ type: "SET_MODEL";          model: string }
{ type: "NEW_CONVERSATION" }
{ type: "SELECT_CONVERSATION"; id: string }
{ type: "DELETE_CONVERSATION"; id: string }
```

### Backend module

Create `backend/modules/my_module.py`:

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/hello")
async def hello():
    return {"hello": "world"}
```

The module loader mounts this router at `/api/modules/my_module/`. Restart the backend to pick up new files (or use `--reload` in development).

List all loaded backend modules: `GET /api/modules`

---

## Environment variables (backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_ENDPOINT_URL` | `http://localhost:11434` | Fallback upstream endpoint |
| `LLM_API_KEY` | *(empty)* | Fallback API key |

Create `backend/.env` to override.
