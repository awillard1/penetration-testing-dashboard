FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY alembic.ini .

RUN mkdir -p data/database data/attachments data/screenshots data/imports data/exports data/reports data/backups data/logs

ENV PENTEST_DASHBOARD_HOST=0.0.0.0
ENV PENTEST_DASHBOARD_PORT=8765

EXPOSE 8765

CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8765"]
