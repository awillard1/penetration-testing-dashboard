# Penetration Testing Dashboard

A local-first penetration test engagement management platform. Built with FastAPI (Python) + React (TypeScript). Runs on Windows and Linux.

## Features

- **Engagement Management** — track clients, engagements, scope, and status
- **Findings Tracker** — CVSS scoring, severity badges, remediation workflow
- **Credential Vault** — AES-256 (Fernet) encrypted secrets, reveal-on-demand
- **Command Library** — reusable commands with `{{variable}}` substitution
- **Payload Library** — injection payloads organized by category
- **Scan Import** — parse Nmap XML, Nessus `.nessus`, Nuclei JSONL, ffuf JSON, Burp Suite XML
- **Report Generation** — HTML, Markdown, DOCX, and JSON export
- **Notes** — per-engagement Markdown notes with autosave
- **Links** — curated reference library with favorites and open tracking
- **Activity Feed** — full audit trail
- **Scheduled Backups** — daily ZIP backup of the SQLite database
- **File Watcher** — monitor directories for new scan files (watchdog)
- **Dashboard** — summary stats and severity chart

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | `python3` (Linux/macOS) or `python` (Windows) |
| Node.js | 18+ | Only needed to build the frontend |
| npm | 9+ | Bundled with Node.js |

---

## Quick Start

### Linux / macOS

```bash
git clone https://github.com/awillard1/penetration-testing-dashboard
cd penetration-testing-dashboard
bash scripts/start.sh
```

Open **http://localhost:8765**

### Windows (PowerShell)

```powershell
git clone https://github.com/awillard1/penetration-testing-dashboard
cd penetration-testing-dashboard
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\start.ps1
```

Open **http://localhost:8765**

---

## Development Mode

Runs the backend with hot-reload and the Vite frontend dev server simultaneously.

```bash
# Linux/macOS
bash scripts/dev.sh

# Windows
.\scripts\dev.ps1
```

- Backend API: **http://localhost:8765/api/v1**
- Interactive API docs: **http://localhost:8765/api/docs** (`/docs` redirects here)
- Frontend (Vite): **http://localhost:5173** (proxies `/api` to backend)

---

## Configuration

Copy `.env.example` to `.env` and edit as needed:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PENTEST_DASHBOARD_SECRET_KEY` | *(auto-generated)* | Fernet encryption key for credentials |
| `PENTEST_DASHBOARD_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `PENTEST_DASHBOARD_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `PENTEST_DASHBOARD_BOOTSTRAP_ADMIN_USERNAME` | `admin` | First-run admin username |
| `PENTEST_DASHBOARD_BOOTSTRAP_ADMIN_PASSWORD` | `change-me-now` | First-run admin password |
| `PENTEST_DASHBOARD_DATABASE_URL` | `sqlite:///./data/database/dashboard.db` | SQLite database path |
| `PENTEST_DASHBOARD_HOST` | `0.0.0.0` | Bind address |
| `PENTEST_DASHBOARD_PORT` | `8765` | Port |
| `PENTEST_DASHBOARD_DATA_DIR` | `data` | Root data directory |
| `PENTEST_DASHBOARD_BACKUP_RETENTION` | `30` | Days to keep backups |

> **Note**: The database is a local SQLite file — no external services required.

---

## Seed Demo Data

```bash
# Linux/macOS
source .venv/bin/activate
python scripts/seed.py

# Windows
.\.venv\Scripts\Activate.ps1
python scripts/seed.py
```

---

## Importing Scan Results

Upload scan files via **Scans** → **Upload Scan File**.

| Format | Extension | Auto-detect |
|--------|-----------|-------------|
| Nmap | `.xml` | ✓ |
| Nessus | `.nessus` | ✓ |
| Nuclei | `.jsonl`, `.json` | ✓ |
| ffuf | `.json` | ✓ |
| Burp Suite | `.xml` | ✓ |

Use scan type **"auto"** to let the importer detect the format from file content.

---

## Running Tests

```bash
# Backend (pytest)
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest backend/tests/ -v

# Frontend (vitest)
cd frontend
npm test
```

---

## Building the Frontend Manually

```bash
cd frontend
npm install
npm run build       # outputs to frontend/dist/
npm run lint        # ESLint
```

The FastAPI backend serves `frontend/dist/` as static files and handles SPA routing.

---

## Project Structure

```
penetration-testing-dashboard/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (21 endpoint files)
│   │   ├── integrations/   # Scan file parsers
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── reporting/      # HTML / Markdown / DOCX report builders
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── utils/          # Generic CRUD helpers
│   │   ├── workers/        # APScheduler, backup worker, file watcher
│   │   ├── config.py       # Settings (Pydantic BaseSettings)
│   │   ├── database.py     # Async SQLAlchemy engine
│   │   ├── main.py         # FastAPI application entry point
│   │   └── security.py     # Argon2 password hashing, Fernet encryption
│   ├── alembic/            # Database migrations
│   └── tests/              # Pytest async integration tests
├── frontend/
│   ├── src/
│   │   ├── api/            # Typed API client (axios)
│   │   ├── components/     # Layout, UI components
│   │   └── pages/          # React route pages
│   └── dist/               # Built static files (served by FastAPI)
├── data/                   # Runtime data (gitignored)
│   ├── db/                 # SQLite database
│   ├── backups/            # Automatic ZIP backups
│   ├── uploads/            # Uploaded evidence files
│   └── reports/            # Generated report files
├── scripts/
│   ├── start.sh            # Linux/macOS start script
│   ├── start.ps1           # Windows start script
│   ├── dev.sh              # Linux/macOS dev mode
│   ├── dev.ps1             # Windows dev mode
│   └── seed.py             # Demo data seeder
├── alembic.ini
├── requirements.txt
├── .env.example
└── docker-compose.yml
```

---

## Docker

```bash
docker compose up --build
```

The container listens on port **8765** and stores data in a named volume.

---

## Security Notes

- Credentials are encrypted at rest using **AES-256-GCM** (Fernet) — the plaintext secret is never stored or logged
- The encryption key is derived from `PENTEST_DASHBOARD_SECRET_KEY` — keep this value secret
- Passwords are hashed with **Argon2id**
- The API uses bearer-token authentication with `POST /api/v1/auth/login` and token refresh with `POST /api/v1/auth/refresh`
- `GET /api`, `GET /api/v1`, and `/docs` redirect to the interactive docs at `/api/docs`
- The first local admin account is bootstrapped from `PENTEST_DASHBOARD_BOOTSTRAP_ADMIN_USERNAME` / `PENTEST_DASHBOARD_BOOTSTRAP_ADMIN_PASSWORD`
- All API responses that include credentials omit the `encrypted_secret` field; use `POST /api/v1/credentials/{id}/reveal` to decrypt on demand
- Keep the bootstrap admin password secret and rotate it immediately after first login

---

## License

MIT
