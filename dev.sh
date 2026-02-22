#!/usr/bin/env bash
set -euo pipefail

# ─── Keystone dev environment ────────────────────────────────────────────────
# Starts Postgres, backend, and frontend with hot reload.
# Auto-reinstalls deps when requirements.txt or package.json change.
#
# Usage:  ./dev.sh
# Stop:   Ctrl+C  (tears down all child processes + Postgres container)
# ─────────────────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
STATE_DIR="$ROOT_DIR/.dev-state"

# Colours for log prefixes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No colour

log()  { echo -e "${GREEN}[dev]${NC} $*"; }
logb() { echo -e "${BLUE}[backend]${NC} $*"; }
logf() { echo -e "${YELLOW}[frontend]${NC} $*"; }
loge() { echo -e "${RED}[error]${NC} $*"; }

# ─── Cleanup on exit ────────────────────────────────────────────────────────
PIDS=()
cleanup() {
    log "Shutting down..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    docker compose -f "$ROOT_DIR/docker-compose.dev.yml" down 2>/dev/null || true
    log "Done."
}
trap cleanup EXIT INT TERM

# ─── Prerequisite checks ────────────────────────────────────────────────────
for cmd in docker node npm python3; do
    if ! command -v "$cmd" &>/dev/null; then
        loge "Required command '$cmd' not found. Please install it."
        exit 1
    fi
done

# ─── State dir (for dep checksums) ──────────────────────────────────────────
mkdir -p "$STATE_DIR"

checksum_file() { md5sum "$1" 2>/dev/null | cut -d' ' -f1; }

needs_install() {
    local file="$1" name="$2"
    local current
    current="$(checksum_file "$file")"
    local stored="$STATE_DIR/$name.md5"
    if [[ ! -f "$stored" ]] || [[ "$(cat "$stored")" != "$current" ]]; then
        return 0  # needs install
    fi
    return 1  # up to date
}

save_checksum() {
    local file="$1" name="$2"
    checksum_file "$file" > "$STATE_DIR/$name.md5"
}

# ─── 1. Start Postgres ──────────────────────────────────────────────────────
log "Starting PostgreSQL..."
docker compose -f "$ROOT_DIR/docker-compose.dev.yml" up -d --wait
log "PostgreSQL is ready."

# ─── 2. Python venv + deps ──────────────────────────────────────────────────
if [[ ! -d "$VENV_DIR" ]]; then
    logb "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

if needs_install "$BACKEND_DIR/requirements.txt" "requirements"; then
    logb "Installing/updating Python dependencies..."
    pip install -q -r "$BACKEND_DIR/requirements.txt"
    save_checksum "$BACKEND_DIR/requirements.txt" "requirements"
else
    logb "Python deps up to date."
fi

# ─── 3. Run Alembic migrations ──────────────────────────────────────────────
logb "Running database migrations..."
cd "$BACKEND_DIR"
if [[ -d "alembic/versions" ]] && ls alembic/versions/*.py &>/dev/null; then
    python -m alembic upgrade head 2>/dev/null || logb "Migrations skipped (tables may already exist)."
else
    logb "No migration files found, tables will be auto-created on startup."
fi
cd "$ROOT_DIR"

# ─── 4. Frontend deps ───────────────────────────────────────────────────────
if needs_install "$FRONTEND_DIR/package.json" "package-json"; then
    logf "Installing/updating Node dependencies..."
    (cd "$FRONTEND_DIR" && npm install --silent)
    save_checksum "$FRONTEND_DIR/package.json" "package-json"
else
    logf "Node deps up to date."
fi

# ─── 5. Start backend (uvicorn with reload) ─────────────────────────────────
logb "Starting FastAPI server on :8000..."
(
    cd "$BACKEND_DIR"
    uvicorn app.main:app \
        --reload \
        --host 0.0.0.0 \
        --port 8000 \
        --reload-dir app \
        --reload-dir modules \
        2>&1 | while IFS= read -r line; do echo -e "${BLUE}[backend]${NC} $line"; done
) &
PIDS+=($!)

# ─── 6. Start frontend (Vite dev server with HMR) ───────────────────────────
logf "Starting Vite dev server on :5173..."
(
    cd "$FRONTEND_DIR"
    npm run dev 2>&1 | while IFS= read -r line; do echo -e "${YELLOW}[frontend]${NC} $line"; done
) &
PIDS+=($!)

# ─── 7. Dependency watcher (background loop) ────────────────────────────────
(
    while true; do
        sleep 5

        # Check Python deps
        if needs_install "$BACKEND_DIR/requirements.txt" "requirements"; then
            logb "requirements.txt changed — reinstalling Python deps..."
            (cd "$BACKEND_DIR" && "$VENV_DIR/bin/pip" install -q -r requirements.txt)
            save_checksum "$BACKEND_DIR/requirements.txt" "requirements"
            logb "Python deps updated. uvicorn --reload will pick up changes."
        fi

        # Check Node deps
        if needs_install "$FRONTEND_DIR/package.json" "package-json"; then
            logf "package.json changed — reinstalling Node deps..."
            (cd "$FRONTEND_DIR" && npm install --silent)
            save_checksum "$FRONTEND_DIR/package.json" "package-json"
            logf "Node deps updated. Vite HMR will pick up changes."
        fi
    done
) &
PIDS+=($!)

# ─── Ready ───────────────────────────────────────────────────────────────────
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  Keystone dev environment is running!"
log ""
log "  Frontend:  http://localhost:5173"
log "  Backend:   http://localhost:8000"
log "  Postgres:  localhost:5432"
log ""
log "  Auto-reload is ON for both frontend and backend."
log "  Deps auto-install when requirements.txt or"
log "  package.json change."
log ""
log "  Press Ctrl+C to stop everything."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for any child to exit
wait
