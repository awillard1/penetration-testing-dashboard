# Pentest Runner

The Pentest Runner is a separate service responsible for executing queued jobs outside the FastAPI web/API process.

## Start

```bash
cd runner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export PENTEST_RUNNER_DASHBOARD_URL=http://127.0.0.1:8765
export PENTEST_RUNNER_ID=<runner-id>
export PENTEST_RUNNER_TOKEN=<runner-token>
python runner_service.py
```

## Environment

- `PENTEST_RUNNER_DASHBOARD_URL`
- `PENTEST_RUNNER_ID`
- `PENTEST_RUNNER_TOKEN`
- `PENTEST_RUNNER_PROFILES` (default: `linux,wsl,windows`)
- `PENTEST_RUNNER_HEARTBEAT_INTERVAL` (default: `10`)
- `PENTEST_RUNNER_CLAIM_INTERVAL` (default: `2`)
- `PENTEST_RUNNER_VERIFY_TLS` (default: `true`)

## Behavior

- Sends heartbeats and tool inventory
- Claims queued jobs
- Executes commands in a separate process
- Streams stdout/stderr chunks back to dashboard
- Observes stop requests and terminates process tree
- Completes jobs with final status/exit code and output tails
