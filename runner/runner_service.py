"""External Pentest Runner service.

This service runs outside FastAPI and executes queued jobs by polling dashboard runner APIs.
"""
from __future__ import annotations

import json
import os
import platform
import shlex
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from shutil import which
from typing import Iterable

import requests


TOOL_CATALOG = [
    "subfinder", "dnsx", "httpx", "naabu", "katana", "nuclei",
    "nmap", "masscan", "ffuf", "feroxbuster", "gobuster", "nikto", "whatweb", "testssl.sh",
    "netexec", "secretsdump.py", "bloodhound-python",
    "semgrep", "gitleaks", "trufflehog",
    "hashcat", "john",
]


@dataclass
class RunnerConfig:
    dashboard_url: str
    runner_id: str
    runner_token: str
    execution_profiles: list[str]
    heartbeat_interval: int = 10
    claim_interval: int = 2
    verify_tls: bool = True


class DashboardClient:
    def __init__(self, cfg: RunnerConfig):
        self.cfg = cfg

    @property
    def headers(self) -> dict[str, str]:
        return {
            "X-Runner-Id": self.cfg.runner_id,
            "X-Runner-Token": self.cfg.runner_token,
            "Content-Type": "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self.cfg.dashboard_url.rstrip('/')}/api/v1/runners{path}"

    def heartbeat(self, capabilities: dict) -> None:
        payload = {
            "hostname": platform.node(),
            "platform": platform.system().lower(),
            "architecture": platform.machine(),
            "capabilities": capabilities,
        }
        requests.post(self._url("/auth/heartbeat"), headers=self.headers, data=json.dumps(payload), timeout=15, verify=self.cfg.verify_tls).raise_for_status()

    def update_tools(self, tools: list[dict]) -> None:
        requests.post(self._url("/auth/tools"), headers=self.headers, data=json.dumps({"tools": tools}), timeout=20, verify=self.cfg.verify_tls).raise_for_status()

    def claim_job(self) -> dict | None:
        payload = {"execution_profiles": self.cfg.execution_profiles}
        resp = requests.post(self._url("/auth/jobs/claim"), headers=self.headers, data=json.dumps(payload), timeout=20, verify=self.cfg.verify_tls)
        resp.raise_for_status()
        return resp.json().get("job")

    def update_job(self, run_id: str, **payload) -> None:
        requests.post(self._url(f"/auth/jobs/{run_id}/update"), headers=self.headers, data=json.dumps(payload), timeout=20, verify=self.cfg.verify_tls).raise_for_status()

    def complete_job(self, run_id: str, status: str, exit_code: int | None, stdout_tail: str, stderr_tail: str) -> None:
        payload = {
            "status": status,
            "exit_code": exit_code,
            "stdout_tail": stdout_tail,
            "stderr_tail": stderr_tail,
        }
        requests.post(self._url(f"/auth/jobs/{run_id}/complete"), headers=self.headers, data=json.dumps(payload), timeout=20, verify=self.cfg.verify_tls).raise_for_status()

    def job_control(self, run_id: str) -> dict:
        resp = requests.get(self._url(f"/auth/jobs/{run_id}/control"), headers=self.headers, timeout=10, verify=self.cfg.verify_tls)
        resp.raise_for_status()
        return resp.json()


def detect_tools(tools: Iterable[str]) -> list[dict]:
    detected: list[dict] = []
    for tool in tools:
        exe = which(tool)
        status = "INSTALLED" if exe else "MISSING"
        version = None
        if exe:
            try:
                proc = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=4)
                version = (proc.stdout or proc.stderr or "").strip().splitlines()[0][:160]
                if not version:
                    version = "UNKNOWN VERSION"
            except Exception:
                version = "UNKNOWN VERSION"
        detected.append({"name": tool, "status": status, "path": exe, "version": version})
    return detected


def build_command_args(job: dict) -> list[str]:
    command = job.get("command") or ""
    args = shlex.split(command, posix=True)
    if not args:
        raise ValueError("empty command")
    if job.get("execution_profile") == "wsl":
        return ["wsl", *args]
    return args


def terminate_process_tree(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], check=False)
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except Exception:
            proc.terminate()


def run_job(client: DashboardClient, job: dict) -> None:
    run_id = job["id"]
    started = time.time()

    try:
        args = build_command_args(job)
    except Exception as exc:
        client.complete_job(run_id, status="failed", exit_code=1, stdout_tail="", stderr_tail=str(exc))
        return

    cwd = job.get("working_directory") or str(Path.cwd())
    stdout_tail = ""
    stderr_tail = ""

    creationflags = 0
    preexec_fn = None
    if os.name != "nt":
        preexec_fn = os.setsid
    else:
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    proc = subprocess.Popen(
        args,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        universal_newlines=True,
        creationflags=creationflags,
        preexec_fn=preexec_fn,
    )

    client.update_job(run_id, status="running", pid=proc.pid)

    def stream_reader(stream, is_stdout: bool):
        nonlocal stdout_tail, stderr_tail
        for line in iter(stream.readline, ""):
            line = line.rstrip("\n") + "\n"
            if is_stdout:
                stdout_tail = (stdout_tail + line)[-4000:]
                client.update_job(run_id, stdout_chunk=line, stdout_tail=stdout_tail, runtime_seconds=time.time() - started)
            else:
                stderr_tail = (stderr_tail + line)[-4000:]
                client.update_job(run_id, stderr_chunk=line, stderr_tail=stderr_tail, runtime_seconds=time.time() - started)

    t_out = threading.Thread(target=stream_reader, args=(proc.stdout, True), daemon=True)
    t_err = threading.Thread(target=stream_reader, args=(proc.stderr, False), daemon=True)
    t_out.start()
    t_err.start()

    while proc.poll() is None:
        time.sleep(1)
        try:
            control = client.job_control(run_id)
            if control.get("stop_requested"):
                terminate_process_tree(proc)
                break
        except Exception:
            pass

    t_out.join(timeout=3)
    t_err.join(timeout=3)
    exit_code = proc.poll()
    status = "completed" if exit_code == 0 else "failed"
    if exit_code is None:
        status = "stopped"
        exit_code = 143

    try:
        client.complete_job(run_id, status=status, exit_code=exit_code, stdout_tail=stdout_tail, stderr_tail=stderr_tail)
    except Exception:
        pass


def main() -> int:
    cfg = RunnerConfig(
        dashboard_url=os.getenv("PENTEST_RUNNER_DASHBOARD_URL", "http://127.0.0.1:8765"),
        runner_id=os.getenv("PENTEST_RUNNER_ID", ""),
        runner_token=os.getenv("PENTEST_RUNNER_TOKEN", ""),
        execution_profiles=[p.strip() for p in os.getenv("PENTEST_RUNNER_PROFILES", "linux,wsl,windows").split(",") if p.strip()],
        heartbeat_interval=int(os.getenv("PENTEST_RUNNER_HEARTBEAT_INTERVAL", "10")),
        claim_interval=int(os.getenv("PENTEST_RUNNER_CLAIM_INTERVAL", "2")),
        verify_tls=os.getenv("PENTEST_RUNNER_VERIFY_TLS", "true").lower() == "true",
    )
    if not cfg.runner_id or not cfg.runner_token:
        print("Missing PENTEST_RUNNER_ID or PENTEST_RUNNER_TOKEN", file=sys.stderr)
        return 1

    client = DashboardClient(cfg)
    tools = detect_tools(TOOL_CATALOG)
    capabilities = {
        "profiles": cfg.execution_profiles,
        "python": sys.version,
        "platform": platform.platform(),
    }

    last_hb = 0.0
    while True:
        now = time.time()
        if now - last_hb >= cfg.heartbeat_interval:
            try:
                client.heartbeat(capabilities)
                client.update_tools(tools)
                last_hb = now
            except Exception as exc:  # noqa: BLE001
                print(f"[runner] heartbeat/tool update failed: {exc}", file=sys.stderr)
                time.sleep(cfg.claim_interval)
                continue

        try:
            job = client.claim_job()
        except Exception as exc:  # noqa: BLE001
            print(f"[runner] job claim failed: {exc}", file=sys.stderr)
            time.sleep(cfg.claim_interval)
            continue
        if job:
            run_job(client, job)
            continue

        time.sleep(cfg.claim_interval)


if __name__ == "__main__":
    raise SystemExit(main())
