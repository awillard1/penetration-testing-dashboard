# Penetration Testing Dashboard

A local-first penetration testing platform built with FastAPI and React for engagement management, operator workflows, evidence handling, and authenticated RBAC-controlled delivery.

## Features

- Command center: dashboard, my work, timeline, tasks, and reporting
- Engagement workflow: engagements, targets, recon, testing, findings, evidence, credentials, and target workspaces
- Operator operations: command preview/execute, job tracking, external runners, scan imports, Burp ingest, and methodology coverage
- Knowledge base: payloads, notes, resources, reusable commands, and supporting references
- Delivery workflow: reports plus review/retest workflows
- Authentication and RBAC: local login, bearer/refresh tokens, bootstrap admin, client-scoped findings, reviewer access, and operator-only execution surfaces
- Security controls: Argon2 password hashing, Fernet-encrypted secrets, masked sensitive HTTP headers, and scope-aware execution safeguards

## Roles and capabilities

- **Admin**: full platform access, including user/bootstrap administration
- **Penetration tester / operator**: full workflow access across engagements, jobs, runners, credentials, evidence, and delivery
- **Reviewer**: review/retest and findings access without operator execution surfaces
- **Client**: restricted authenticated access to client-scoped findings

Frontend capability checks are centralized in `frontend/src/lib/capabilities.ts`.

## Key workflows restored on the auth branch

- `/workspace/:id` target workspace
- `/my-work`
- `/testing`
- `/recon`
- `/jobs`
- `/runners`
- `/review`
- Workflow sidebar sections: Command Center, Engagement, Operations, Knowledge, Delivery, Admin

## Quick start

### Linux / macOS

```bash
git clone https://github.com/awillard1/penetration-testing-dashboard
cd penetration-testing-dashboard
bash scripts/start.sh
```

### Windows (PowerShell)

```powershell
git clone https://github.com/awillard1/penetration-testing-dashboard
cd penetration-testing-dashboard
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\start.ps1
```

Open `http://localhost:8765`.

## Development

```bash
# backend + frontend dev mode
bash scripts/dev.sh

# frontend only
cd frontend
npm install
npm run lint
npm run build
npm test

# backend
cd ..
python -m pytest backend/tests/test_api.py -q
```

- Backend docs: `http://localhost:8765/api/docs`
- `/docs`, `/api`, and `/api/v1` redirect to the API docs
- Vite dev server proxies `/api` to the backend

## Authentication configuration

Key environment variables:

- `PENTEST_DASHBOARD_SECRET_KEY`
- `PENTEST_DASHBOARD_ACCESS_TOKEN_EXPIRE_MINUTES`
- `PENTEST_DASHBOARD_REFRESH_TOKEN_EXPIRE_DAYS`
- `PENTEST_DASHBOARD_BOOTSTRAP_ADMIN_USERNAME`
- `PENTEST_DASHBOARD_BOOTSTRAP_ADMIN_PASSWORD`
- `PENTEST_DASHBOARD_OPERATOR_COMMAND_RUNNER_ENABLED`
- `PENTEST_DASHBOARD_OPERATOR_BURP_INGEST_ENABLED`

## Scan and evidence workflows

- Scan uploads support Nmap XML, Nessus, Nuclei JSON/JSONL, ffuf JSON, Burp XML, and generic JSON normalization
- Evidence supports upload, detail, preview, inline/file access, download, and finding attachment/detachment
- Operator recon snapshots and diffs preserve workspace history over time

## Testing

```bash
cd frontend
npm test
npm run lint
npm run build

cd ..
python -m pytest backend/tests/test_api.py -q
```

## Notes

- Credentials are encrypted at rest and only revealed on demand through authenticated APIs
- Command execution remains explicit-confirmation only and keeps scope warnings/override audit fields
- External runner auth uses runner headers, while dashboard/operator APIs require user authentication

## License

MIT
