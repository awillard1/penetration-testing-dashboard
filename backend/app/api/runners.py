"""Runner registry and runner-control APIs."""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_session
from backend.app.auth import require_staff_user
from backend.app.models.base import utcnow
from backend.app.models.operator import CommandRun
from backend.app.models.runner import RunnerJobEvent, RunnerNode
from backend.app.services.operator_assets import calculate_runtime

router = APIRouter()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _require_runner(
    session: AsyncSession,
    runner_id: str | None,
    runner_token: str | None,
) -> RunnerNode:
    if not runner_id or not runner_token:
        raise HTTPException(401, "Runner authentication headers required")
    runner = await session.get(RunnerNode, runner_id)
    if not runner or not runner.is_enabled:
        raise HTTPException(403, "Runner not enabled")
    if runner.token_hash != _hash_token(runner_token):
        raise HTTPException(403, "Invalid runner token")
    return runner


class RunnerCreateBody(BaseModel):
    name: str = Field(min_length=2)
    hostname: str | None = None
    platform: str | None = None
    architecture: str | None = None


class RunnerUpdateBody(BaseModel):
    name: str | None = None
    is_enabled: bool | None = None


class RunnerHeartbeatBody(BaseModel):
    hostname: str | None = None
    platform: str | None = None
    architecture: str | None = None
    capabilities: dict | None = None


class RunnerToolsBody(BaseModel):
    tools: list[dict] = Field(default_factory=list)


class ClaimJobsBody(BaseModel):
    execution_profiles: list[str] = Field(default_factory=lambda: ["linux", "wsl", "windows"])


class JobUpdateBody(BaseModel):
    status: str | None = None
    pid: int | None = None
    stdout_chunk: str | None = None
    stderr_chunk: str | None = None
    runtime_seconds: float | None = None
    stdout_tail: str | None = None
    stderr_tail: str | None = None


class JobCompleteBody(BaseModel):
    exit_code: int | None = None
    status: str = "completed"
    stdout_tail: str | None = None
    stderr_tail: str | None = None


@router.get("")
async def list_runners(
    session: AsyncSession = Depends(get_session),
    _=Depends(require_staff_user),
):
    rows = (await session.execute(select(RunnerNode).order_by(RunnerNode.created_at.desc()))).scalars().all()
    stale_cutoff = utcnow() - timedelta(seconds=45)
    payload = []
    for row in rows:
        computed_online = bool(row.is_enabled and row.last_heartbeat and row.last_heartbeat >= stale_cutoff)
        payload.append(
            {
                "id": row.id,
                "name": row.name,
                "hostname": row.hostname,
                "platform": row.platform,
                "architecture": row.architecture,
                "is_enabled": row.is_enabled,
                "is_online": computed_online,
                "last_heartbeat": row.last_heartbeat,
                "capabilities": json.loads(row.capabilities_json) if row.capabilities_json else {},
                "tools": json.loads(row.tools_json) if row.tools_json else [],
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
        )
    return payload


@router.post("", status_code=201)
async def create_runner(
    body: RunnerCreateBody,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_staff_user),
):
    token = secrets.token_urlsafe(32)
    row = RunnerNode(
        name=body.name,
        hostname=body.hostname,
        platform=body.platform,
        architecture=body.architecture,
        token_hash=_hash_token(token),
        is_enabled=True,
    )
    session.add(row)
    await session.flush()
    return {"id": row.id, "token": token, "name": row.name}


@router.patch("/{runner_id}")
async def update_runner(
    runner_id: str,
    body: RunnerUpdateBody,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_staff_user),
):
    row = await session.get(RunnerNode, runner_id)
    if not row:
        raise HTTPException(404, "Runner not found")
    if body.name is not None:
        row.name = body.name
    if body.is_enabled is not None:
        row.is_enabled = body.is_enabled
    if not row.is_enabled:
        row.is_online = False
    await session.flush()
    return {"id": row.id, "name": row.name, "is_enabled": row.is_enabled}


@router.post("/{runner_id}/revoke")
async def revoke_runner_token(
    runner_id: str,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_staff_user),
):
    row = await session.get(RunnerNode, runner_id)
    if not row:
        raise HTTPException(404, "Runner not found")
    token = secrets.token_urlsafe(32)
    row.token_hash = _hash_token(token)
    await session.flush()
    return {"id": row.id, "token": token}


@router.get("/{runner_id}/jobs")
async def list_runner_jobs(
    runner_id: str,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_staff_user),
):
    rows = (
        await session.execute(
            select(CommandRun)
            .where(CommandRun.runner_id == runner_id)
            .order_by(CommandRun.created_at.desc())
            .limit(200)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "engagement_id": r.engagement_id,
            "target_id": r.target_id,
            "status": r.status,
            "command_preview": r.command_preview,
            "created_at": r.created_at,
            "started_at": r.started_at,
            "ended_at": r.ended_at,
            "runtime_seconds": r.runtime_seconds,
        }
        for r in rows
    ]


@router.post("/auth/heartbeat")
async def heartbeat(
    body: RunnerHeartbeatBody,
    x_runner_id: str | None = Header(default=None),
    x_runner_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    runner = await _require_runner(session, x_runner_id, x_runner_token)
    runner.hostname = body.hostname or runner.hostname
    runner.platform = body.platform or runner.platform
    runner.architecture = body.architecture or runner.architecture
    runner.capabilities_json = json.dumps(body.capabilities or {}, ensure_ascii=False)
    runner.last_heartbeat = utcnow()
    runner.is_online = True
    await session.flush()
    return {"ok": True, "runner_id": runner.id}


@router.post("/auth/tools")
async def update_tools(
    body: RunnerToolsBody,
    x_runner_id: str | None = Header(default=None),
    x_runner_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    runner = await _require_runner(session, x_runner_id, x_runner_token)
    runner.tools_json = json.dumps(body.tools, ensure_ascii=False)
    runner.last_heartbeat = utcnow()
    runner.is_online = True
    await session.flush()
    return {"ok": True}


@router.post("/auth/jobs/claim")
async def claim_job(
    body: ClaimJobsBody,
    x_runner_id: str | None = Header(default=None),
    x_runner_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    runner = await _require_runner(session, x_runner_id, x_runner_token)
    runner.last_heartbeat = utcnow()
    runner.is_online = True

    rows = (
        await session.execute(
            select(CommandRun)
            .where(CommandRun.status == "queued")
            .where(CommandRun.execution_profile.in_(body.execution_profiles))
            .order_by(CommandRun.created_at.asc())
            .limit(1)
        )
    ).scalars().all()
    if not rows:
        await session.flush()
        return {"job": None}

    run = rows[0]
    run.status = "running"
    run.runner_id = runner.id
    run.runner_name = runner.name
    run.started_at = run.started_at or utcnow()

    session.add(
        RunnerJobEvent(
            run_id=run.id,
            runner_id=runner.id,
            event_type="claimed",
            message=f"Job claimed by runner {runner.name}",
        )
    )
    await session.flush()
    return {
        "job": {
            "id": run.id,
            "engagement_id": run.engagement_id,
            "target_id": run.target_id,
            "command": run.command_executed or run.command_preview,
            "working_directory": run.working_directory,
            "execution_profile": run.execution_profile,
            "stop_requested": run.stop_requested,
        }
    }


@router.get("/auth/jobs/{run_id}/control")
async def job_control(
    run_id: str,
    x_runner_id: str | None = Header(default=None),
    x_runner_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    runner = await _require_runner(session, x_runner_id, x_runner_token)
    run = await session.get(CommandRun, run_id)
    if not run:
        raise HTTPException(404, "Job not found")
    if run.runner_id != runner.id:
        raise HTTPException(403, "Runner does not own this job")
    return {"stop_requested": run.stop_requested, "status": run.status}


@router.post("/auth/jobs/{run_id}/update")
async def update_job(
    run_id: str,
    body: JobUpdateBody,
    x_runner_id: str | None = Header(default=None),
    x_runner_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    runner = await _require_runner(session, x_runner_id, x_runner_token)
    run = await session.get(CommandRun, run_id)
    if not run:
        raise HTTPException(404, "Job not found")
    if run.runner_id and run.runner_id != runner.id:
        raise HTTPException(403, "Runner does not own this job")

    if body.status:
        run.status = body.status
    if body.pid is not None:
        run.pid = body.pid
    if body.runtime_seconds is not None:
        run.runtime_seconds = body.runtime_seconds
    if body.stdout_chunk:
        run.stdout = (run.stdout or "") + body.stdout_chunk
    if body.stderr_chunk:
        run.stderr = (run.stderr or "") + body.stderr_chunk
    if body.stdout_tail is not None:
        run.stdout_tail = body.stdout_tail
    if body.stderr_tail is not None:
        run.stderr_tail = body.stderr_tail

    runner.last_heartbeat = utcnow()
    runner.is_online = True
    await session.flush()
    return {"ok": True}


@router.post("/auth/jobs/{run_id}/complete")
async def complete_job(
    run_id: str,
    body: JobCompleteBody,
    x_runner_id: str | None = Header(default=None),
    x_runner_token: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    runner = await _require_runner(session, x_runner_id, x_runner_token)
    run = await session.get(CommandRun, run_id)
    if not run:
        raise HTTPException(404, "Job not found")
    if run.runner_id and run.runner_id != runner.id:
        raise HTTPException(403, "Runner does not own this job")

    run.exit_code = body.exit_code
    run.status = body.status
    run.ended_at = utcnow()
    run.runtime_seconds = calculate_runtime(run.started_at, run.ended_at)
    run.stop_requested = False
    if body.stdout_tail is not None:
        run.stdout_tail = body.stdout_tail
    if body.stderr_tail is not None:
        run.stderr_tail = body.stderr_tail

    runner.last_heartbeat = utcnow()
    runner.is_online = True
    session.add(
        RunnerJobEvent(
            run_id=run.id,
            runner_id=runner.id,
            event_type="completed",
            message=f"Job completed with status {run.status}",
        )
    )
    await session.flush()
    return {"ok": True}
