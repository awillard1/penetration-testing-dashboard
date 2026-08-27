# Runner Installation

## 1) Prerequisites
- Python 3.11+
- Git
- Access to dashboard URL
- Runner registration token from Settings → Runners

## 2) Clone and prepare
```bash
git clone <repo-url>
cd penetration-testing-dashboard/runner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3) Configure environment
```bash
export PENTEST_RUNNER_DASHBOARD_URL=http://127.0.0.1:8765
export PENTEST_RUNNER_ID=<runner-id>
export PENTEST_RUNNER_TOKEN=<runner-token>
export PENTEST_RUNNER_PROFILES=linux,wsl,windows
```

## 4) Start runner
```bash
python runner_service.py
```

## 5) Verify registration
- Open Dashboard Settings → Runners
- Confirm heartbeat timestamp updates
- Confirm tool inventory appears

## 6) Test job flow
- Queue command from Target Workspace/Jobs
- Confirm runner claims job and status changes to RUNNING
- Confirm stdout/stderr update in Jobs UI

## Kali/Ubuntu/WSL
Use above Linux steps in native Kali/Ubuntu or WSL shell.

## Windows
Use PowerShell with equivalent environment variables and `python runner_service.py`.

## Remote Linux Runner
- Ensure network route to dashboard API
- Export dashboard URL/token variables
- Run runner as service (systemd or process manager)

## Troubleshooting
- 401/403: verify runner ID/token
- No jobs claimed: verify execution profile compatibility
- No heartbeat: verify dashboard URL and firewall
- Stop not working: verify runner can terminate subprocess tree on host OS
