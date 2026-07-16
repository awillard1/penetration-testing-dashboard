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
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY alembic.ini .

# Copy built frontend so the SPA fallback route is registered
COPY --from=frontend-builder /frontend/dist ./frontend/dist

RUN mkdir -p data/database data/attachments data/screenshots data/imports data/exports data/reports data/backups data/logs

ENV PENTEST_DASHBOARD_HOST=0.0.0.0
ENV PENTEST_DASHBOARD_PORT=8765

EXPOSE 8765

CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8765"]
