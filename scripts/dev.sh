#!/usr/bin/env bash
# =============================================================================
# Development mode: runs backend (hot-reload) + frontend (Vite dev server)
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# Activate venv if it exists
[ -d ".venv" ] && source .venv/bin/activate

# Ensure data dirs
mkdir -p data/db data/backups data/uploads data/reports data/exports data/logs

# Copy .env if needed
[ ! -f ".env" ] && cp .env.example .env

# Start backend with reload
echo "[DEV] Starting backend on :8765 (hot-reload)…"
python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8765 --reload &
BACKEND_PID=$!

# Start frontend dev server
echo "[DEV] Starting Vite dev server on :5173…"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8765"
echo "  Frontend: http://localhost:5173  (proxies /api to backend)"
echo ""
echo "  Press Ctrl+C to stop both."
echo ""

cleanup() {
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  # Give processes up to 5 s to exit gracefully, then force-kill
  for pid in $BACKEND_PID $FRONTEND_PID; do
    for _ in 1 2 3 4 5; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM
wait
