# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY alembic.ini .

RUN mkdir -p data/database data/attachments data/screenshots data/imports data/exports data/reports data/backups data/logs

ENV PENTEST_DASHBOARD_HOST=0.0.0.0
ENV PENTEST_DASHBOARD_PORT=8765

EXPOSE 8765

# Debug runtime identity before starting uvicorn
ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "set -x; echo '=== Runtime Identity ==='; id; whoami; python - <<'PY'\nimport os\nprint('uid=',os.getuid(),'gid=',os.getgid())\nprint('cwd=',os.getcwd())\nPY\necho '========================'; exec python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8765 --log-level debug --access-log"]
