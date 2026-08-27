"""Operator workspace, methodology, jobs, and Burp ingest APIs."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.database import get_session
from backend.app.models.base import utcnow
from backend.app.models.command import Command
from backend.app.models.credential import Credential
from backend.app.models.evidence import Evidence
from backend.app.models.finding import Finding
from backend.app.models.note import Note
from backend.app.models.operator import (
    AssetEndpoint,
    AssetHost,
    AssetService,
    AssetUrl,
    CommandRun,
    CredentialUsage,
    EndpointParameter,
    EngagementChecklistItem,
    FootholdSession,
    HttpMessage,
    MethodologyItem,
    MethodologyProfile,
    MethodologyResult,
    ReconSnapshot,
    ReconSnapshotItem,
    ScreenshotAnnotation,
)
from backend.app.models.scan import ScanImport
from backend.app.models.target import Target
from backend.app.models.task import Task
from backend.app.services.operator_assets import (
    create_web_artifacts,
    evaluate_scope,
    parse_url_for_endpoint,
)

router = APIRouter()


METHODOLOGY_SEED: dict[str, list[tuple[str, str]]] = {
    "Web": [
        ("Authentication", "Validate login, MFA, and brute-force protections."),
        ("Authorization", "Validate vertical/horizontal privilege controls."),
        ("Session Management", "Validate token/session lifecycle and fixation defenses."),
        ("Input Validation", "Test injection classes (SQLi, XSS, SSTI, XXE)."),
        ("Business Logic", "Test workflow and state transitions for abuse."),
        ("File Upload", "Test upload restrictions, content handling, and storage."),
        ("SSRF", "Test server-side request forgery vectors."),
        ("CORS", "Validate cross-origin policy and trust boundaries."),
    ],
    "API": [
        ("AuthN/AuthZ", "Validate object-level and function-level authorization."),
        ("Rate Limiting", "Validate abuse protection and anti-automation controls."),
        ("Schema Validation", "Validate strict schema and content-type controls."),
        ("Mass Assignment", "Validate writable fields and model binding controls."),
    ],
    "Network": [
        ("Service Enumeration", "Enumerate exposed ports and service versions."),
        ("Configuration Review", "Validate hardening baseline and unsafe defaults."),
        ("Lateral Movement", "Test segmentation and credential abuse paths."),
    ],
    "AD": [("Domain Recon", "Enumerate trust paths, ACLs, and attack primitives.")],
    "Cloud": [("Identity", "Validate IAM privilege boundaries and key handling.")],
    "Mobile": [("App Transport", "Validate TLS pinning and sensitive data handling.")],
    "Wireless": [("Access Controls", "Validate wireless encryption and segmentation.")],
}


class CommandPreviewRequest(BaseModel):
    engagement_id: str
    target_id: str
    command_id: str | None = None
    command_text: str
    execution_profile: Literal["linux", "wsl", "windows"] = "linux"
    working_directory: str | None = None


class CommandExecuteRequest(CommandPreviewRequest):
    explicit_confirmation: bool = Field(default=False)
    scope_override: bool = Field(default=False)
    scope_override_reason: str | None = None


class MethodologyResultUpsert(BaseModel):
    engagement_id: str
    target_id: str
    profile_id: str
    item_id: str
    status: Literal["not_tested", "testing", "passed", "finding", "na"]
    finding_id: str | None = None
    evidence_id: str | None = None
    notes: str | None = None


class BurpIngestRequest(BaseModel):
    engagement_id: str
    target_id: str | None = None
    url: str
    method: str = "GET"
    status_code: int | None = None
    content_type: str | None = None
    auth_requirement: str | None = None
    request_raw: str
    response_raw: str | None = None
    create_candidate_finding: bool = False
    candidate_finding_title: str | None = None
    scope_override: bool = False
    scope_override_reason: str | None = None


class ScreenshotAnnotationRequest(BaseModel):
    edited_evidence_id: str | None = None
    annotation_json: str
    caption: str | None = None
    display_order: int = 0


class CredentialUsageRequest(BaseModel):
    engagement_id: str
    target_id: str | None = None
    host_id: str | None = None
    service_id: str | None = None
    endpoint_id: str | None = None
    usage_context: str | None = None
    validation_state: Literal["valid", "invalid", "locked", "expired", "unknown"] = "unknown"
    last_validation_date: datetime | None = None


class EndpointUpdateRequest(BaseModel):
    testing_status: Literal["not_tested", "testing", "passed", "finding", "na", "blocked"] | None = None
    auth_requirement: str | None = None
    notes: str | None = None
    interesting: bool | None = None


class ReconSnapshotCreateRequest(BaseModel):
    engagement_id: str
    target_id: str | None = None
    label: str | None = None
    source_run_id: str | None = None


async def _ensure_methodology_seed(session: AsyncSession) -> None:
    existing = (await session.execute(select(func.count()).select_from(MethodologyProfile))).scalar() or 0
    if existing:
        return

    for profile_name, items in METHODOLOGY_SEED.items():
        profile = MethodologyProfile(name=profile_name, description=f"{profile_name} testing methodology")
        session.add(profile)
        await session.flush()
        for idx, (title, guidance) in enumerate(items):
            session.add(
                MethodologyItem(
                    profile_id=profile.id,
                    title=title,
                    guidance=guidance,
                    display_order=idx,
                    category=profile_name,
                )
            )
    await session.flush()


def _resolve_working_directory(raw_path: str | None) -> Path:
    base_cwd = Path.cwd().resolve()
    base_data = settings.data_dir.resolve()
    selector = (raw_path or "repo").strip().lower()
    if selector == "repo":
        return base_cwd
    if selector == "data":
        return base_data
    raise HTTPException(400, "working_directory must be one of: repo, data")


async def _collect_recon_entities(session: AsyncSession, engagement_id: str, target_id: str | None):
    host_q = select(AssetHost).where(AssetHost.engagement_id == engagement_id)
    endpoint_q = select(AssetEndpoint).where(AssetEndpoint.engagement_id == engagement_id)
    service_q = select(AssetService).where(AssetService.engagement_id == engagement_id)
    url_q = select(AssetUrl).where(AssetUrl.engagement_id == engagement_id)
    param_q = select(EndpointParameter).join(AssetEndpoint, EndpointParameter.endpoint_id == AssetEndpoint.id).where(
        AssetEndpoint.engagement_id == engagement_id
    )
    if target_id:
        host_q = host_q.where((AssetHost.target_id == target_id) | (AssetHost.target_id.is_(None)))
        endpoint_q = endpoint_q.where((AssetEndpoint.target_id == target_id) | (AssetEndpoint.target_id.is_(None)))

    hosts = (await session.execute(host_q)).scalars().all()
    services = (await session.execute(service_q)).scalars().all()
    urls = (await session.execute(url_q)).scalars().all()
    endpoints = (await session.execute(endpoint_q)).scalars().all()
    params = (await session.execute(param_q)).scalars().all()
    return hosts, services, urls, endpoints, params


@router.post("/methodology/seed")
async def seed_methodology(session: AsyncSession = Depends(get_session)):
    await _ensure_methodology_seed(session)
    return {"status": "ok"}


@router.get("/methodology/profiles")
async def list_methodology_profiles(session: AsyncSession = Depends(get_session)):
    await _ensure_methodology_seed(session)
    profiles = (await session.execute(select(MethodologyProfile).order_by(MethodologyProfile.name.asc()))).scalars().all()
    items = (await session.execute(select(MethodologyItem))).scalars().all()
    item_map: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        item_map.setdefault(item.profile_id, []).append(
            {
                "id": item.id,
                "title": item.title,
                "category": item.category,
                "guidance": item.guidance,
                "display_order": item.display_order,
            }
        )
    for rows in item_map.values():
        rows.sort(key=lambda r: r["display_order"])
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "items": item_map.get(p.id, []),
        }
        for p in profiles
    ]


@router.put("/methodology/results")
async def upsert_methodology_result(body: MethodologyResultUpsert, session: AsyncSession = Depends(get_session)):
    q = select(MethodologyResult).where(
        MethodologyResult.target_id == body.target_id,
        MethodologyResult.item_id == body.item_id,
    )
    row = (await session.execute(q.limit(1))).scalars().first()
    if row:
        row.status = body.status
        row.finding_id = body.finding_id
        row.evidence_id = body.evidence_id
        row.notes = body.notes
        row.tested_at = utcnow()
    else:
        row = MethodologyResult(
            engagement_id=body.engagement_id,
            target_id=body.target_id,
            profile_id=body.profile_id,
            item_id=body.item_id,
            status=body.status,
            finding_id=body.finding_id,
            evidence_id=body.evidence_id,
            notes=body.notes,
            tested_at=utcnow(),
        )
        session.add(row)
    await session.flush()
    return {"id": row.id, "status": row.status, "tested_at": row.tested_at}


@router.get("/workspace")
async def get_workspace(
    engagement_id: str,
    target_id: str,
    session: AsyncSession = Depends(get_session),
):
    target = await session.get(Target, target_id)
    if not target or target.engagement_id != engagement_id:
        raise HTTPException(404, "Target not found")

    host_filters = [AssetHost.engagement_id == engagement_id]
    hostname_match = target.hostname
    ip_match = target.ip_address
    if (not hostname_match and not ip_match) and target.url:
        hostname_match, _, _ = parse_url_for_endpoint(target.url)
    if hostname_match or ip_match:
        host_match_filters = []
        if hostname_match:
            host_match_filters.append(AssetHost.hostname == hostname_match)
        if ip_match:
            host_match_filters.append(AssetHost.ip_address == ip_match)
        host_identity_filter = host_match_filters[0] if len(host_match_filters) == 1 else or_(*host_match_filters)
        host_filters.append(
            or_(
                AssetHost.target_id == target.id,
                and_(AssetHost.target_id.is_(None), host_identity_filter),
            )
        )
    else:
        host_filters.append(AssetHost.target_id == target.id)

    hosts = (await session.execute(select(AssetHost).where(*host_filters))).scalars().all()
    host_ids = [h.id for h in hosts]

    services = (
        (await session.execute(select(AssetService).where(AssetService.host_id.in_(host_ids))))
        .scalars()
        .all()
        if host_ids
        else []
    )

    urls = (
        (await session.execute(select(AssetUrl).where(AssetUrl.host_id.in_(host_ids)))).scalars().all()
        if host_ids
        else []
    )
    url_ids = [u.id for u in urls]

    endpoints = (
        (await session.execute(select(AssetEndpoint).where(AssetEndpoint.url_id.in_(url_ids)))).scalars().all()
        if url_ids
        else []
    )
    endpoint_ids = [e.id for e in endpoints]

    parameters = (
        (await session.execute(select(EndpointParameter).where(EndpointParameter.endpoint_id.in_(endpoint_ids))))
        .scalars()
        .all()
        if endpoint_ids
        else []
    )

    credentials = (
        await session.execute(select(Credential).where(Credential.engagement_id == engagement_id, Credential.target_id == target_id))
    ).scalars().all()
    finding_filters = [Finding.engagement_id == engagement_id]
    endpoint_filters = []
    if target.hostname:
        endpoint_filters.append(Finding.affected_endpoints.ilike(f"%{target.hostname}%"))
    if target.ip_address:
        endpoint_filters.append(Finding.affected_endpoints.ilike(f"%{target.ip_address}%"))
    if target.url:
        endpoint_filters.append(Finding.affected_endpoints.ilike(f"%{target.url}%"))
    if endpoint_filters:
        finding_filters.append(or_(*endpoint_filters))
    else:
        finding_filters.append(Finding.id == "__no_findings__")
    findings = (await session.execute(select(Finding).where(*finding_filters))).scalars().all()
    evidence = (
        await session.execute(select(Evidence).where(Evidence.engagement_id == engagement_id, Evidence.target_id == target_id))
    ).scalars().all()
    notes = (await session.execute(select(Note).where(Note.engagement_id == engagement_id, Note.target_id == target_id))).scalars().all()
    tasks = (await session.execute(select(Task).where(Task.engagement_id == engagement_id, Task.target_id == target_id))).scalars().all()
    scans = (await session.execute(select(ScanImport).where(ScanImport.engagement_id == engagement_id))).scalars().all()
    runs = (
        await session.execute(
            select(CommandRun)
            .where(CommandRun.engagement_id == engagement_id)
            .where((CommandRun.target_id == target_id) | (CommandRun.target_id.is_(None)))
            .order_by(CommandRun.created_at.desc())
        )
    ).scalars().all()
    http_messages = (
        await session.execute(
            select(HttpMessage)
            .where(HttpMessage.engagement_id == engagement_id)
            .where((HttpMessage.target_id == target_id) | (HttpMessage.target_id.is_(None)))
            .order_by(HttpMessage.created_at.desc())
            .limit(100)
        )
    ).scalars().all()

    methodology_rows = (
        await session.execute(select(MethodologyResult).where(MethodologyResult.engagement_id == engagement_id, MethodologyResult.target_id == target_id))
    ).scalars().all()

    status_counts = {"not_tested": 0, "testing": 0, "passed": 0, "finding": 0, "na": 0}
    for row in methodology_rows:
        status_counts[row.status] = status_counts.get(row.status, 0) + 1
    covered_denominator = max(sum(status_counts.values()) - status_counts.get("na", 0), 0)
    covered_numerator = covered_denominator - status_counts.get("not_tested", 0)
    coverage_percent = (covered_numerator / covered_denominator * 100.0) if covered_denominator else 0.0

    return {
        "target": {
            "id": target.id,
            "hostname": target.hostname,
            "ip_address": target.ip_address,
            "url": target.url,
            "in_scope": target.in_scope,
            "engagement_id": target.engagement_id,
        },
        "inventory": {
            "hosts": [
                {
                    "id": h.id,
                    "hostname": h.hostname,
                    "ip_address": h.ip_address,
                    "source_tool": h.source_tool,
                    "first_seen": h.first_seen,
                    "last_seen": h.last_seen,
                }
                for h in hosts
            ],
            "services": [
                {
                    "id": s.id,
                    "host_id": s.host_id,
                    "port": s.port,
                    "protocol": s.protocol,
                    "service_name": s.service_name,
                    "technology": s.technology,
                    "source_tool": s.source_tool,
                }
                for s in services
            ],
            "urls": [{"id": u.id, "host_id": u.host_id, "service_id": u.service_id, "url": u.url} for u in urls],
            "endpoints": [
                {
                    "id": e.id,
                    "url_id": e.url_id,
                    "method": e.method,
                    "path": e.path,
                    "query_params": e.query_params,
                    "body_params": e.body_params,
                    "content_type": e.content_type,
                    "status_code": e.status_code,
                    "auth_requirement": e.auth_requirement,
                    "testing_status": e.testing_status,
                    "last_tested_at": e.last_tested_at,
                    "source_tool": e.source_tool,
                }
                for e in endpoints
            ],
            "parameters": [
                {
                    "id": p.id,
                    "endpoint_id": p.endpoint_id,
                    "location": p.location,
                    "name": p.name,
                    "sample_value": p.sample_value,
                }
                for p in parameters
            ],
        },
        "credentials": [
            {
                "id": c.id,
                "username": c.username,
                "domain": c.domain,
                "secret_type": c.secret_type,
                "is_validated": c.is_validated,
                "validation_date": c.validation_date,
            }
            for c in credentials
        ],
        "findings": [
            {
                "id": f.id,
                "title": f.title,
                "severity": f.severity,
                "status": f.status,
                "retest_date": f.retest_date,
                "retest_result": f.retest_result,
            }
            for f in findings
        ],
        "scan_history": [
            {
                "id": s.id,
                "filename": s.filename,
                "scan_type": s.scan_type,
                "status": s.status,
                "imported_at": s.imported_at,
            }
            for s in scans
        ],
        "evidence": [
            {
                "id": e.id,
                "title": e.title,
                "evidence_type": e.evidence_type,
                "source_tool": e.source_tool,
                "created_at": e.created_at,
            }
            for e in evidence
        ],
        "notes": [{"id": n.id, "title": n.title, "note_type": n.note_type, "updated_at": n.updated_at} for n in notes],
        "tasks": [{"id": t.id, "title": t.title, "status": t.status, "priority": t.priority} for t in tasks],
        "command_runs": [
            {
                "id": r.id,
                "status": r.status,
                "pid": r.pid,
                "execution_profile": r.execution_profile,
                "command_preview": r.command_preview,
                "runtime_seconds": r.runtime_seconds,
                "created_at": r.created_at,
            }
            for r in runs
        ],
        "http_messages": [
            {
                "id": m.id,
                "method": m.method,
                "path": m.path,
                "status_code": m.status_code,
                "source_tool": m.source_tool,
                "created_at": m.created_at,
            }
            for m in http_messages
        ],
        "coverage": {
            "status_counts": status_counts,
            "coverage_percent": round(coverage_percent, 2),
            "total_items": sum(status_counts.values()),
            "results": [
                {"id": r.id, "profile_id": r.profile_id, "item_id": r.item_id, "status": r.status}
                for r in methodology_rows
            ],
        },
    }


@router.get("/endpoints/{endpoint_id}/detail")
async def endpoint_detail(endpoint_id: str, session: AsyncSession = Depends(get_session)):
    endpoint = await session.get(AssetEndpoint, endpoint_id)
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")

    params = (
        await session.execute(select(EndpointParameter).where(EndpointParameter.endpoint_id == endpoint_id))
    ).scalars().all()
    http_messages = (
        await session.execute(
            select(HttpMessage)
            .where(HttpMessage.endpoint_id == endpoint_id)
            .order_by(HttpMessage.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    jobs = (
        await session.execute(
            select(CommandRun)
            .where(CommandRun.engagement_id == endpoint.engagement_id)
            .where((CommandRun.target_id == endpoint.target_id) | (CommandRun.target_id.is_(None)))
            .order_by(CommandRun.created_at.desc())
            .limit(25)
        )
    ).scalars().all()
    findings = (
        await session.execute(
            select(Finding)
            .where(Finding.engagement_id == endpoint.engagement_id)
            .where(Finding.affected_endpoints.ilike(f"%{endpoint.path}%"))
            .order_by(Finding.created_at.desc())
            .limit(25)
        )
    ).scalars().all()
    evidence = (
        await session.execute(
            select(Evidence)
            .where(Evidence.engagement_id == endpoint.engagement_id)
            .where((Evidence.target_id == endpoint.target_id) | (Evidence.notes.ilike(f"%{endpoint_id}%")))
            .order_by(Evidence.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    notes = (
        await session.execute(
            select(Note)
            .where(Note.engagement_id == endpoint.engagement_id)
            .where((Note.target_id == endpoint.target_id) | (Note.content.ilike(f"%{endpoint.path}%")))
            .order_by(Note.updated_at.desc())
            .limit(25)
        )
    ).scalars().all()
    credential_usages = (
        await session.execute(select(CredentialUsage).where(CredentialUsage.endpoint_id == endpoint_id))
    ).scalars().all()
    scans = (
        await session.execute(
            select(ScanImport).where(ScanImport.engagement_id == endpoint.engagement_id).order_by(ScanImport.created_at.desc()).limit(10)
        )
    ).scalars().all()
    provenance = {}
    if endpoint.provenance_json:
        try:
            provenance = json.loads(endpoint.provenance_json)
        except Exception:
            provenance = {"raw": endpoint.provenance_json}

    return {
        "endpoint": {
            "id": endpoint.id,
            "engagement_id": endpoint.engagement_id,
            "target_id": endpoint.target_id,
            "host_id": endpoint.host_id,
            "service_id": endpoint.service_id,
            "url_id": endpoint.url_id,
            "method": endpoint.method,
            "path": endpoint.path,
            "query_params": endpoint.query_params,
            "body_params": endpoint.body_params,
            "content_type": endpoint.content_type,
            "status_code": endpoint.status_code,
            "auth_requirement": endpoint.auth_requirement,
            "testing_status": endpoint.testing_status,
            "last_tested_at": endpoint.last_tested_at,
            "first_seen": endpoint.first_seen,
            "last_seen": endpoint.last_seen,
            "source_tool": endpoint.source_tool,
            "discovered_by": endpoint.discovered_by,
            "provenance": provenance,
        },
        "parameters": [
            {"id": p.id, "location": p.location, "name": p.name, "sample_value": p.sample_value}
            for p in params
        ],
        "http_messages": [
            {
                "id": m.id,
                "method": m.method,
                "path": m.path,
                "status_code": m.status_code,
                "content_type": m.content_type,
                "request_raw": m.request_raw,
                "response_raw": m.response_raw,
                "created_at": m.created_at,
            }
            for m in http_messages
        ],
        "findings": [
            {"id": f.id, "title": f.title, "severity": f.severity, "status": f.status}
            for f in findings
        ],
        "credentials": [
            {
                "id": u.id,
                "credential_id": u.credential_id,
                "validation_state": u.validation_state,
                "last_validation_date": u.last_validation_date,
            }
            for u in credential_usages
        ],
        "evidence": [
            {"id": e.id, "title": e.title, "evidence_type": e.evidence_type, "created_at": e.created_at}
            for e in evidence
        ],
        "notes": [{"id": n.id, "title": n.title, "updated_at": n.updated_at} for n in notes],
        "jobs": [
            {"id": j.id, "status": j.status, "command_preview": j.command_preview, "created_at": j.created_at}
            for j in jobs
        ],
        "scans": [
            {"id": s.id, "filename": s.filename, "scan_type": s.scan_type, "created_at": s.created_at}
            for s in scans
        ],
    }


@router.patch("/endpoints/{endpoint_id}")
async def update_endpoint(endpoint_id: str, body: EndpointUpdateRequest, session: AsyncSession = Depends(get_session)):
    endpoint = await session.get(AssetEndpoint, endpoint_id)
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")

    if body.testing_status is not None:
        endpoint.testing_status = body.testing_status
        endpoint.last_tested_at = utcnow()
    if body.auth_requirement is not None:
        endpoint.auth_requirement = body.auth_requirement

    provenance = {}
    if endpoint.provenance_json:
        try:
            provenance = json.loads(endpoint.provenance_json)
        except Exception:
            provenance = {"raw": endpoint.provenance_json}
    if body.notes is not None:
        provenance["notes"] = body.notes
    if body.interesting is not None:
        provenance["interesting"] = body.interesting
    endpoint.provenance_json = json.dumps(provenance, ensure_ascii=False)
    await session.flush()
    return {"id": endpoint.id, "testing_status": endpoint.testing_status, "auth_requirement": endpoint.auth_requirement}


@router.get("/http-messages")
async def list_http_messages(
    engagement_id: str,
    target_id: str | None = None,
    endpoint_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(HttpMessage).where(HttpMessage.engagement_id == engagement_id)
    if target_id:
        q = q.where(HttpMessage.target_id == target_id)
    if endpoint_id:
        q = q.where(HttpMessage.endpoint_id == endpoint_id)
    rows = (await session.execute(q.order_by(HttpMessage.created_at.desc()).limit(200))).scalars().all()

    def _masked_payload(raw: str | None) -> str | None:
        if not raw:
            return raw
        lines = []
        for line in raw.splitlines():
            low = line.lower()
            if low.startswith("authorization:") or low.startswith("cookie:") or low.startswith("x-api-key:"):
                key = line.split(":", 1)[0]
                lines.append(f"{key}: ***REDACTED***")
            else:
                lines.append(line)
        return "\n".join(lines)

    return [
        {
            "id": m.id,
            "target_id": m.target_id,
            "endpoint_id": m.endpoint_id,
            "method": m.method,
            "path": m.path,
            "status_code": m.status_code,
            "content_type": m.content_type,
            "request_raw": _masked_payload(m.request_raw),
            "response_raw": _masked_payload(m.response_raw),
            "request_pretty": m.request_pretty,
            "response_pretty": m.response_pretty,
            "source_tool": m.source_tool,
            "created_at": m.created_at,
        }
        for m in rows
    ]


@router.post("/command-runs/preview")
async def preview_command_run(body: CommandPreviewRequest, session: AsyncSession = Depends(get_session)):
    target = await session.get(Target, body.target_id)
    if not target or target.engagement_id != body.engagement_id:
        raise HTTPException(404, "Target not found")

    is_in_scope, scope_warning = await evaluate_scope(
        session,
        engagement_id=body.engagement_id,
        target_values=[target.hostname or "", target.ip_address or "", target.url or ""],
    )

    profile_shell = {"linux": "bash", "wsl": "wsl", "windows": "powershell"}
    return {
        "command_preview": body.command_text,
        "execution_profile": body.execution_profile,
        "shell": profile_shell.get(body.execution_profile, "bash"),
        "working_directory": body.working_directory,
        "requires_scope_override": not is_in_scope,
        "scope_warning": scope_warning,
    }


@router.post("/command-runs/execute")
async def execute_command_run(body: CommandExecuteRequest, session: AsyncSession = Depends(get_session)):
    if not settings.operator_command_runner_enabled:
        raise HTTPException(403, "Operator command runner is disabled by configuration")
    if not body.explicit_confirmation:
        raise HTTPException(400, "Explicit confirmation required before execution")

    target = await session.get(Target, body.target_id)
    if not target or target.engagement_id != body.engagement_id:
        raise HTTPException(404, "Target not found")

    is_in_scope, scope_warning = await evaluate_scope(
        session,
        engagement_id=body.engagement_id,
        target_values=[target.hostname or "", target.ip_address or "", target.url or ""],
    )
    if not is_in_scope and not body.scope_override:
        raise HTTPException(400, f"Out-of-scope warning: {scope_warning}")
    if body.scope_override and not body.scope_override_reason:
        raise HTTPException(400, "scope_override_reason is required when overriding scope")

    template_name = None
    if body.command_id:
        cmd = await session.get(Command, body.command_id)
        if cmd:
            template_name = cmd.name

    resolved_working_dir = _resolve_working_directory(body.working_directory)
    run = CommandRun(
        engagement_id=body.engagement_id,
        target_id=body.target_id,
        command_id=body.command_id,
        template_name=template_name,
        execution_profile=body.execution_profile,
        command_preview=body.command_text,
        command_executed=body.command_text,
        status="queued",
        working_directory=str(resolved_working_dir),
        explicit_confirmation=True,
        scope_warning=scope_warning,
        scope_override=body.scope_override,
        scope_override_reason=body.scope_override_reason,
    )
    session.add(run)
    await session.flush()

    return {
        "id": run.id,
        "status": "queued",
        "scope_warning": scope_warning,
        "scope_override": body.scope_override,
    }


@router.get("/command-runs")
async def list_command_runs(
    engagement_id: str,
    target_id: str | None = None,
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(CommandRun).where(CommandRun.engagement_id == engagement_id)
    if target_id:
        q = q.where(CommandRun.target_id == target_id)
    if status:
        q = q.where(CommandRun.status == status)
    rows = (await session.execute(q.order_by(CommandRun.created_at.desc()).limit(500))).scalars().all()

    return [
        {
            "id": row.id,
            "status": row.status,
            "pid": row.pid,
            "engagement_id": row.engagement_id,
            "target_id": row.target_id,
            "command_preview": row.command_preview,
            "command_executed": row.command_executed,
            "execution_profile": row.execution_profile,
            "runner_id": row.runner_id,
            "runner_name": row.runner_name,
            "exit_code": row.exit_code,
            "runtime_seconds": row.runtime_seconds,
            "working_directory": row.working_directory,
            "output_location": row.output_location,
            "stdout": row.stdout,
            "stderr": row.stderr,
            "stdout_tail": row.stdout_tail,
            "stderr_tail": row.stderr_tail,
            "stop_requested": row.stop_requested,
            "scope_warning": row.scope_warning,
            "scope_override": row.scope_override,
            "created_at": row.created_at,
            "started_at": row.started_at,
            "ended_at": row.ended_at,
        }
        for row in rows
    ]


@router.get("/command-runs/stream")
async def stream_command_runs(
    engagement_id: str,
    target_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    async def event_stream():
        last_seen = None
        while True:
            q = select(CommandRun).where(CommandRun.engagement_id == engagement_id)
            if target_id:
                q = q.where(CommandRun.target_id == target_id)
            if last_seen is not None:
                q = q.where(CommandRun.updated_at > last_seen)
            rows = (await session.execute(q.order_by(CommandRun.updated_at.asc()).limit(200))).scalars().all()
            for row in rows:
                last_seen = row.updated_at
                payload = {
                    "id": row.id,
                    "status": row.status,
                    "pid": row.pid,
                    "target_id": row.target_id,
                    "command_preview": row.command_preview,
                    "command_executed": row.command_executed,
                    "stdout_tail": row.stdout_tail,
                    "stderr_tail": row.stderr_tail,
                    "runtime_seconds": row.runtime_seconds,
                    "runner_id": row.runner_id,
                    "runner_name": row.runner_name,
                    "stop_requested": row.stop_requested,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                }
                yield f"event: run_update\\ndata: {json.dumps(payload, ensure_ascii=False)}\\n\\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/command-runs/{run_id}/stop")
async def stop_command_run(run_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(CommandRun, run_id)
    if not row:
        raise HTTPException(404, "Command run not found")
    if row.status in {"completed", "failed", "stopped"}:
        return {"status": row.status, "message": "Job already finished"}
    row.stop_requested = True
    if row.status == "queued":
        row.status = "stopped"
        row.ended_at = utcnow()
    await session.flush()
    return {"status": row.status, "stop_requested": True}


@router.post("/integrations/burp/ingest")
async def burp_ingest(body: BurpIngestRequest, session: AsyncSession = Depends(get_session)):
    if not settings.operator_burp_ingest_enabled:
        raise HTTPException(403, "Burp ingest integration is disabled by configuration")
    host, path, query = parse_url_for_endpoint(body.url)
    target = None
    if body.target_id:
        target = await session.get(Target, body.target_id)
    if not target:
        target = (
            await session.execute(
                select(Target).where(
                    Target.engagement_id == body.engagement_id,
                    (Target.hostname == host) | (Target.url.ilike(f"%{host}%")),
                )
            )
        ).scalars().first()
    if not target:
        target = Target(
            engagement_id=body.engagement_id,
            hostname=host,
            url=f"https://{host}",
            source="burp",
            in_scope=True,
            first_seen=utcnow(),
            last_seen=utcnow(),
        )
        session.add(target)
        await session.flush()

    is_in_scope, scope_warning = await evaluate_scope(
        session,
        engagement_id=body.engagement_id,
        target_values=[host, target.hostname or "", target.ip_address or "", target.url or ""],
    )
    if not is_in_scope and not body.scope_override:
        raise HTTPException(400, f"Out-of-scope warning: {scope_warning}")
    if body.scope_override and not body.scope_override_reason:
        raise HTTPException(400, "scope_override_reason is required when overriding scope")

    endpoint = await create_web_artifacts(
        session,
        engagement_id=body.engagement_id,
        target_id=target.id,
        host=host,
        ip_address=target.ip_address,
        url=body.url,
        method=body.method,
        path=path,
        query_params=query,
        content_type=body.content_type,
        status_code=body.status_code,
        auth_requirement=body.auth_requirement,
        source_tool="burp",
        discovered_by="burp_ingest",
    )

    message = HttpMessage(
        engagement_id=body.engagement_id,
        target_id=target.id,
        endpoint_id=endpoint.id,
        method=body.method.upper(),
        path=path,
        status_code=body.status_code,
        content_type=body.content_type,
        request_raw=body.request_raw,
        response_raw=body.response_raw,
        source_tool="burp",
    )
    session.add(message)
    await session.flush()

    evidence = Evidence(
        engagement_id=body.engagement_id,
        target_id=target.id,
        title=f"Burp {body.method.upper()} {path}",
        description="Captured from Burp integration ingest",
        evidence_type="http_message",
        source_tool="burp",
        command_used="Burp -> Send to Dashboard",
        notes=f"http_message_id={message.id}",
    )
    session.add(evidence)
    await session.flush()

    finding = None
    if body.create_candidate_finding:
        finding = Finding(
            engagement_id=body.engagement_id,
            title=body.candidate_finding_title or f"Candidate finding from {body.method.upper()} {path}",
            description="Candidate finding generated from selected Burp traffic.",
            affected_endpoints=body.url,
            severity="informational",
            status="needs_review",
            source="burp",
        )
        session.add(finding)
        await session.flush()

    return {
        "target_id": target.id,
        "endpoint_id": endpoint.id,
        "http_message_id": message.id,
        "evidence_id": evidence.id,
        "finding_id": finding.id if finding else None,
        "scope_warning": scope_warning,
        "scope_override": body.scope_override,
    }


@router.get("/recon")
async def recon_workspace(
    engagement_id: str,
    target_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    hosts, services, urls, endpoints, params = await _collect_recon_entities(session, engagement_id, target_id)
    return {
        "hosts": [
            {"id": h.id, "hostname": h.hostname, "ip_address": h.ip_address, "source_tool": h.source_tool, "first_seen": h.first_seen, "last_seen": h.last_seen}
            for h in hosts
        ],
        "services": [
            {"id": s.id, "host_id": s.host_id, "port": s.port, "protocol": s.protocol, "service_name": s.service_name, "technology": s.technology, "source_tool": s.source_tool}
            for s in services
        ],
        "urls": [{"id": u.id, "host_id": u.host_id, "url": u.url, "source_tool": u.source_tool} for u in urls],
        "endpoints": [
            {"id": e.id, "target_id": e.target_id, "method": e.method, "path": e.path, "testing_status": e.testing_status, "status_code": e.status_code, "source_tool": e.source_tool, "first_seen": e.first_seen, "last_seen": e.last_seen}
            for e in endpoints
        ],
        "parameters": [
            {"id": p.id, "endpoint_id": p.endpoint_id, "location": p.location, "name": p.name, "sample_value": p.sample_value}
            for p in params
        ],
    }


@router.post("/recon/snapshots", status_code=201)
async def create_recon_snapshot(body: ReconSnapshotCreateRequest, session: AsyncSession = Depends(get_session)):
    hosts, services, urls, endpoints, params = await _collect_recon_entities(session, body.engagement_id, body.target_id)
    snapshot = ReconSnapshot(
        engagement_id=body.engagement_id,
        target_id=body.target_id,
        label=body.label,
        source_run_id=body.source_run_id,
    )
    session.add(snapshot)
    await session.flush()

    def add_item(entity_type: str, key: str, value: str, source_tool: str | None = None):
        session.add(
            ReconSnapshotItem(
                snapshot_id=snapshot.id,
                entity_type=entity_type,
                normalized_key=key[:512],
                display_value=value,
                source_tool=source_tool,
                source_job_id=body.source_run_id,
                confidence=0.8,
            )
        )

    for h in hosts:
        key = f"host:{(h.hostname or '').lower()}:{h.ip_address or ''}"
        add_item("host", key, h.hostname or h.ip_address or h.id, h.source_tool)
    for s in services:
        key = f"service:{s.host_id}:{s.port}:{(s.protocol or '').lower()}:{(s.service_name or '').lower()}"
        add_item("service", key, f"{s.port}/{s.protocol} {s.service_name or ''}".strip(), s.source_tool)
    for u in urls:
        key = f"url:{u.url.lower()}"
        add_item("url", key, u.url, u.source_tool)
    for e in endpoints:
        key = f"endpoint:{(e.method or '').upper()}:{e.path.lower()}"
        add_item("endpoint", key, f"{e.method} {e.path}", e.source_tool)
    for p in params:
        key = f"param:{p.endpoint_id}:{p.location.lower()}:{p.name.lower()}"
        add_item("parameter", key, f"{p.location}:{p.name}", p.source_tool)

    await session.flush()
    return {"id": snapshot.id, "label": snapshot.label, "created_at": snapshot.created_at}


@router.get("/recon/snapshots")
async def list_recon_snapshots(
    engagement_id: str,
    target_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(ReconSnapshot).where(ReconSnapshot.engagement_id == engagement_id)
    if target_id:
        q = q.where((ReconSnapshot.target_id == target_id) | (ReconSnapshot.target_id.is_(None)))
    rows = (await session.execute(q.order_by(ReconSnapshot.created_at.desc()).limit(100))).scalars().all()
    return [
        {
            "id": r.id,
            "label": r.label,
            "target_id": r.target_id,
            "source_run_id": r.source_run_id,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/recon/diff")
async def recon_diff(base_snapshot_id: str, compare_snapshot_id: str, session: AsyncSession = Depends(get_session)):
    base_items = (
        await session.execute(select(ReconSnapshotItem).where(ReconSnapshotItem.snapshot_id == base_snapshot_id))
    ).scalars().all()
    compare_items = (
        await session.execute(select(ReconSnapshotItem).where(ReconSnapshotItem.snapshot_id == compare_snapshot_id))
    ).scalars().all()
    base_map = {f"{i.entity_type}:{i.normalized_key}": i for i in base_items}
    compare_map = {f"{i.entity_type}:{i.normalized_key}": i for i in compare_items}

    added_keys = sorted(set(compare_map) - set(base_map))
    removed_keys = sorted(set(base_map) - set(compare_map))
    changed_keys = sorted(k for k in (set(base_map) & set(compare_map)) if base_map[k].display_value != compare_map[k].display_value)

    def ser(item: ReconSnapshotItem):
        return {"id": item.id, "entity_type": item.entity_type, "key": item.normalized_key, "value": item.display_value, "source_tool": item.source_tool}

    return {
        "added": [ser(compare_map[k]) for k in added_keys],
        "removed": [ser(base_map[k]) for k in removed_keys],
        "changed": [{"before": ser(base_map[k]), "after": ser(compare_map[k])} for k in changed_keys],
    }


@router.get("/jobs")
async def jobs_dashboard(
    engagement_id: str,
    status: str | None = None,
    target_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(CommandRun).where(CommandRun.engagement_id == engagement_id)
    if status:
        q = q.where(CommandRun.status == status)
    if target_id:
        q = q.where(CommandRun.target_id == target_id)
    rows = (await session.execute(q.order_by(CommandRun.created_at.desc()).limit(500))).scalars().all()
    return {
        "running": sum(1 for r in rows if r.status == "running"),
        "completed": sum(1 for r in rows if r.status == "completed"),
        "failed": sum(1 for r in rows if r.status == "failed"),
        "stopped": sum(1 for r in rows if r.status == "stopped"),
        "jobs": [
            {
                "id": r.id,
                "status": r.status,
                "pid": r.pid,
                "runtime_seconds": r.runtime_seconds,
                "target_id": r.target_id,
                "engagement_id": r.engagement_id,
                "command": r.command_executed or r.command_preview,
                "execution_profile": r.execution_profile,
                "runner_id": r.runner_id,
                "runner_name": r.runner_name,
                "output_location": r.output_location,
                "stop_requested": r.stop_requested,
                "started_at": r.started_at,
                "ended_at": r.ended_at,
            }
            for r in rows
        ],
    }


@router.post("/evidence/{evidence_id}/annotations")
async def add_screenshot_annotation(
    evidence_id: str,
    body: ScreenshotAnnotationRequest,
    session: AsyncSession = Depends(get_session),
):
    evidence = await session.get(Evidence, evidence_id)
    if not evidence:
        raise HTTPException(404, "Evidence not found")
    row = ScreenshotAnnotation(
        evidence_id=evidence_id,
        edited_evidence_id=body.edited_evidence_id,
        annotation_json=body.annotation_json,
        caption=body.caption,
        display_order=body.display_order,
    )
    session.add(row)
    await session.flush()
    return {"id": row.id}


@router.get("/evidence/{evidence_id}/annotations")
async def list_screenshot_annotations(evidence_id: str, session: AsyncSession = Depends(get_session)):
    rows = (
        await session.execute(
            select(ScreenshotAnnotation)
            .where(ScreenshotAnnotation.evidence_id == evidence_id)
            .order_by(ScreenshotAnnotation.display_order.asc(), ScreenshotAnnotation.created_at.asc())
        )
    ).scalars().all()
    return [
        {
            "id": row.id,
            "edited_evidence_id": row.edited_evidence_id,
            "annotation_json": row.annotation_json,
            "caption": row.caption,
            "display_order": row.display_order,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/credentials/{credential_id}/usages")
async def add_credential_usage(
    credential_id: str,
    body: CredentialUsageRequest,
    session: AsyncSession = Depends(get_session),
):
    credential = await session.get(Credential, credential_id)
    if not credential:
        raise HTTPException(404, "Credential not found")

    usage = CredentialUsage(
        credential_id=credential_id,
        engagement_id=body.engagement_id,
        target_id=body.target_id,
        host_id=body.host_id,
        service_id=body.service_id,
        endpoint_id=body.endpoint_id,
        usage_context=body.usage_context,
        validation_state=body.validation_state,
        last_validation_date=body.last_validation_date,
    )
    session.add(usage)
    await session.flush()
    return {"id": usage.id}


@router.get("/credentials/{credential_id}/usages")
async def list_credential_usages(credential_id: str, session: AsyncSession = Depends(get_session)):
    rows = (
        await session.execute(
            select(CredentialUsage)
            .where(CredentialUsage.credential_id == credential_id)
            .order_by(CredentialUsage.updated_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": row.id,
            "engagement_id": row.engagement_id,
            "target_id": row.target_id,
            "host_id": row.host_id,
            "service_id": row.service_id,
            "endpoint_id": row.endpoint_id,
            "usage_context": row.usage_context,
            "validation_state": row.validation_state,
            "last_validation_date": row.last_validation_date,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


@router.get("/checklists")
async def list_engagement_checklists(
    engagement_id: str,
    checklist_type: str | None = Query(None, pattern="^(pre_engagement|closeout)?$"),
    session: AsyncSession = Depends(get_session),
):
    q = select(EngagementChecklistItem).where(EngagementChecklistItem.engagement_id == engagement_id)
    if checklist_type:
        q = q.where(EngagementChecklistItem.checklist_type == checklist_type)
    rows = (await session.execute(q.order_by(EngagementChecklistItem.checklist_type, EngagementChecklistItem.created_at))).scalars().all()
    return [
        {
            "id": row.id,
            "checklist_type": row.checklist_type,
            "title": row.title,
            "required": row.required,
            "status": row.status,
            "completed_at": row.completed_at,
            "notes": row.notes,
        }
        for row in rows
    ]


@router.get("/footholds")
async def list_footholds(engagement_id: str, session: AsyncSession = Depends(get_session)):
    rows = (
        await session.execute(
            select(FootholdSession)
            .where(FootholdSession.engagement_id == engagement_id)
            .order_by(FootholdSession.created_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": row.id,
            "target_id": row.target_id,
            "host": row.host,
            "user_context": row.user_context,
            "privilege_level": row.privilege_level,
            "originating_finding_id": row.originating_finding_id,
            "credential_id": row.credential_id,
            "acquired_at": row.acquired_at,
            "cleanup_status": row.cleanup_status,
            "cleanup_notes": row.cleanup_notes,
        }
        for row in rows
    ]
