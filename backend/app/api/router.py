"""Main API router."""
from __future__ import annotations

from fastapi import APIRouter

from backend.app.api import (
    activity,
    backups,
    clients,
    commands,
    credentials,
    engagements,
    evidence,
    findings,
    health,
    links,
    notes,
    operator,
    payloads,
    reports,
    runners,
    scans,
    scope,
    search,
    settings,
    targets,
    tasks,
    time_entries,
    watch_paths,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(engagements.router, prefix="/engagements", tags=["engagements"])
api_router.include_router(scope.router, prefix="/scope", tags=["scope"])
api_router.include_router(targets.router, prefix="/targets", tags=["targets"])
api_router.include_router(findings.router, prefix="/findings", tags=["findings"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["evidence"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["credentials"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(notes.router, prefix="/notes", tags=["notes"])
api_router.include_router(operator.router, prefix="/operator", tags=["operator"])
api_router.include_router(links.router, prefix="/links", tags=["links"])
api_router.include_router(commands.router, prefix="/commands", tags=["commands"])
api_router.include_router(payloads.router, prefix="/payloads", tags=["payloads"])
api_router.include_router(scans.router, prefix="/scans", tags=["scans"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(runners.router, prefix="/runners", tags=["runners"])
api_router.include_router(activity.router, prefix="/activity", tags=["activity"])
api_router.include_router(time_entries.router, prefix="/time-entries", tags=["time-entries"])
api_router.include_router(backups.router, prefix="/backups", tags=["backups"])
api_router.include_router(watch_paths.router, prefix="/watch-paths", tags=["watch-paths"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
