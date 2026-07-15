#!/usr/bin/env bash
# =============================================================================
# Penetration Testing Dashboard — Linux/macOS start script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Python check ────────────────────────────────────────────────────────────
command -v python3 &>/dev/null || error "python3 not found. Install Python 3.11+."
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
info "Python $PY_VER detected"

# ── Virtual environment ──────────────────────────────────────────────────────
if [ ! -d ".venv" ]; then
    info "Creating virtual environment…"
    python3 -m venv .venv
fi
source .venv/bin/activate
ok "Virtual environment active"

# ── Python dependencies ──────────────────────────────────────────────────────
info "Installing/updating Python dependencies…"
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
ok "Python dependencies installed"

# ── Frontend build ───────────────────────────────────────────────────────────
if [ ! -d "frontend/dist" ]; then
    info "Building frontend…"
    command -v node &>/dev/null || error "Node.js not found. Install Node.js 18+."
    command -v npm  &>/dev/null || error "npm not found."
    (cd frontend && npm install --silent && npm run build)
    ok "Frontend built"
else
    ok "Frontend dist already exists (run 'cd frontend && npm run build' to rebuild)"
fi

# ── Data directories ─────────────────────────────────────────────────────────
mkdir -p data/db data/backups data/uploads data/reports data/exports data/logs
ok "Data directories ready"

# ── .env file ────────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    warn ".env not found, copying from .env.example"
    cp .env.example .env
fi

# ── Launch ───────────────────────────────────────────────────────────────────
info "Starting server on http://0.0.0.0:8765"
echo ""
echo -e "  ${GREEN}Dashboard:${NC} http://localhost:8765"
echo ""
exec python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8765 "$@"
