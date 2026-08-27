"""Helpers for operator asset normalization and scope checks."""
from __future__ import annotations

import json
from datetime import datetime
from urllib.parse import parse_qsl, urlparse

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import utcnow
from backend.app.models.operator import (
    AssetEndpoint,
    AssetHost,
    AssetService,
    AssetUrl,
    EndpointParameter,
)
from backend.app.models.scope import ScopeItem


def _merge_provenance(existing: str | None, source_tool: str | None, discovered_by: str | None) -> str:
    payload = []
    if existing:
        try:
            payload = json.loads(existing)
        except json.JSONDecodeError:
            payload = []
    entry = {
        "source_tool": source_tool or "unknown",
        "discovered_by": discovered_by or "import",
        "seen_at": utcnow().isoformat(),
    }
    payload.append(entry)
    return json.dumps(payload[-50:])


async def get_or_create_host(
    session: AsyncSession,
    *,
    engagement_id: str,
    target_id: str | None,
    hostname: str | None,
    ip_address: str | None,
    operating_system: str | None = None,
    source_tool: str | None = None,
    discovered_by: str | None = None,
) -> AssetHost:
    host_query = select(AssetHost).where(AssetHost.engagement_id == engagement_id)
    if hostname and ip_address:
        host_query = host_query.where(
            or_(
                and_(AssetHost.hostname == hostname, AssetHost.ip_address == ip_address),
                AssetHost.hostname == hostname,
                AssetHost.ip_address == ip_address,
            )
        )
    elif hostname:
        host_query = host_query.where(AssetHost.hostname == hostname)
    elif ip_address:
        host_query = host_query.where(AssetHost.ip_address == ip_address)
    else:
        raise ValueError("host requires hostname or ip_address")

    host = (await session.execute(host_query.limit(1))).scalars().first()
    now = utcnow()
    if host:
        host.last_seen = now
        host.target_id = host.target_id or target_id
        host.operating_system = host.operating_system or operating_system
        host.provenance_json = _merge_provenance(host.provenance_json, source_tool, discovered_by)
    else:
        host = AssetHost(
            engagement_id=engagement_id,
            target_id=target_id,
            hostname=hostname,
            ip_address=ip_address,
            operating_system=operating_system,
            source_tool=source_tool,
            discovered_by=discovered_by,
            first_seen=now,
            last_seen=now,
            provenance_json=_merge_provenance(None, source_tool, discovered_by),
        )
        session.add(host)
    await session.flush()
    return host


async def get_or_create_service(
    session: AsyncSession,
    *,
    engagement_id: str,
    host_id: str,
    port: int | None,
    protocol: str | None,
    service_name: str | None,
    banner: str | None = None,
    technology: str | None = None,
    source_tool: str | None = None,
    discovered_by: str | None = None,
) -> AssetService:
    q = select(AssetService).where(
        AssetService.host_id == host_id,
        AssetService.port == port,
        AssetService.protocol == protocol,
        AssetService.service_name == service_name,
    )
    now = utcnow()
    service = (await session.execute(q.limit(1))).scalars().first()
    if service:
        service.last_seen = now
        service.banner = service.banner or banner
        service.technology = service.technology or technology
        service.provenance_json = _merge_provenance(service.provenance_json, source_tool, discovered_by)
    else:
        service = AssetService(
            engagement_id=engagement_id,
            host_id=host_id,
            port=port,
            protocol=protocol,
            service_name=service_name,
            banner=banner,
            technology=technology,
            source_tool=source_tool,
            discovered_by=discovered_by,
            first_seen=now,
            last_seen=now,
            provenance_json=_merge_provenance(None, source_tool, discovered_by),
        )
        session.add(service)
    await session.flush()
    return service


async def get_or_create_url(
    session: AsyncSession,
    *,
    engagement_id: str,
    host_id: str,
    service_id: str | None,
    url: str,
    source_tool: str | None = None,
    discovered_by: str | None = None,
) -> AssetUrl:
    q = select(AssetUrl).where(AssetUrl.host_id == host_id, AssetUrl.url == url)
    now = utcnow()
    row = (await session.execute(q.limit(1))).scalars().first()
    if row:
        row.last_seen = now
        row.provenance_json = _merge_provenance(row.provenance_json, source_tool, discovered_by)
        if service_id and not row.service_id:
            row.service_id = service_id
    else:
        row = AssetUrl(
            engagement_id=engagement_id,
            host_id=host_id,
            service_id=service_id,
            url=url,
            source_tool=source_tool,
            discovered_by=discovered_by,
            first_seen=now,
            last_seen=now,
            provenance_json=_merge_provenance(None, source_tool, discovered_by),
        )
        session.add(row)
    await session.flush()
    return row


async def get_or_create_endpoint(
    session: AsyncSession,
    *,
    engagement_id: str,
    target_id: str | None,
    host_id: str,
    service_id: str | None,
    url_id: str,
    method: str,
    path: str,
    query_params: str | None = None,
    body_params: str | None = None,
    content_type: str | None = None,
    status_code: int | None = None,
    auth_requirement: str | None = None,
    source_tool: str | None = None,
    discovered_by: str | None = None,
) -> AssetEndpoint:
    q = select(AssetEndpoint).where(
        AssetEndpoint.url_id == url_id,
        AssetEndpoint.method == method.upper(),
        AssetEndpoint.path == path,
    )
    now = utcnow()
    endpoint = (await session.execute(q.limit(1))).scalars().first()
    if endpoint:
        endpoint.last_seen = now
        endpoint.status_code = status_code or endpoint.status_code
        endpoint.content_type = content_type or endpoint.content_type
        endpoint.auth_requirement = auth_requirement or endpoint.auth_requirement
        endpoint.query_params = query_params or endpoint.query_params
        endpoint.body_params = body_params or endpoint.body_params
        endpoint.provenance_json = _merge_provenance(endpoint.provenance_json, source_tool, discovered_by)
        endpoint.target_id = endpoint.target_id or target_id
    else:
        endpoint = AssetEndpoint(
            engagement_id=engagement_id,
            target_id=target_id,
            host_id=host_id,
            service_id=service_id,
            url_id=url_id,
            method=method.upper(),
            path=path,
            query_params=query_params,
            body_params=body_params,
            content_type=content_type,
            status_code=status_code,
            auth_requirement=auth_requirement,
            source_tool=source_tool,
            discovered_by=discovered_by,
            first_seen=now,
            last_seen=now,
            provenance_json=_merge_provenance(None, source_tool, discovered_by),
        )
        session.add(endpoint)
    await session.flush()
    return endpoint


async def upsert_parameter(
    session: AsyncSession,
    *,
    endpoint_id: str,
    location: str,
    name: str,
    sample_value: str | None = None,
    source_tool: str | None = None,
    discovered_by: str | None = None,
) -> EndpointParameter:
    q = select(EndpointParameter).where(
        EndpointParameter.endpoint_id == endpoint_id,
        EndpointParameter.location == location,
        EndpointParameter.name == name,
    )
    row = (await session.execute(q.limit(1))).scalars().first()
    now = utcnow()
    if row:
        row.last_seen = now
        row.sample_value = row.sample_value or sample_value
        row.source_tool = row.source_tool or source_tool
        row.discovered_by = row.discovered_by or discovered_by
    else:
        row = EndpointParameter(
            endpoint_id=endpoint_id,
            location=location,
            name=name,
            sample_value=sample_value,
            source_tool=source_tool,
            discovered_by=discovered_by,
            first_seen=now,
            last_seen=now,
        )
        session.add(row)
    await session.flush()
    return row


async def create_web_artifacts(
    session: AsyncSession,
    *,
    engagement_id: str,
    target_id: str | None,
    host: str,
    ip_address: str | None,
    url: str,
    method: str,
    path: str,
    query_params: str | None = None,
    body_params: str | None = None,
    content_type: str | None = None,
    status_code: int | None = None,
    auth_requirement: str | None = None,
    source_tool: str | None = None,
    discovered_by: str | None = None,
) -> AssetEndpoint:
    parsed = urlparse(url)
    scheme = parsed.scheme.lower() if parsed.scheme else "https"
    port = parsed.port or (443 if scheme == "https" else 80)
    protocol = "tcp"
    service_name = "https" if scheme == "https" else "http"

    host_row = await get_or_create_host(
        session,
        engagement_id=engagement_id,
        target_id=target_id,
        hostname=host,
        ip_address=ip_address,
        source_tool=source_tool,
        discovered_by=discovered_by,
    )
    service = await get_or_create_service(
        session,
        engagement_id=engagement_id,
        host_id=host_row.id,
        port=port,
        protocol=protocol,
        service_name=service_name,
        source_tool=source_tool,
        discovered_by=discovered_by,
    )
    url_row = await get_or_create_url(
        session,
        engagement_id=engagement_id,
        host_id=host_row.id,
        service_id=service.id,
        url=f"{scheme}://{parsed.netloc}",
        source_tool=source_tool,
        discovered_by=discovered_by,
    )
    endpoint = await get_or_create_endpoint(
        session,
        engagement_id=engagement_id,
        target_id=target_id,
        host_id=host_row.id,
        service_id=service.id,
        url_id=url_row.id,
        method=method,
        path=path,
        query_params=query_params,
        body_params=body_params,
        content_type=content_type,
        status_code=status_code,
        auth_requirement=auth_requirement,
        source_tool=source_tool,
        discovered_by=discovered_by,
    )

    if query_params:
        for key, value in parse_qsl(query_params, keep_blank_values=True):
            await upsert_parameter(
                session,
                endpoint_id=endpoint.id,
                location="query",
                name=key,
                sample_value=value,
                source_tool=source_tool,
                discovered_by=discovered_by,
            )

    return endpoint


async def evaluate_scope(
    session: AsyncSession,
    *,
    engagement_id: str,
    target_values: list[str],
) -> tuple[bool, str | None]:
    in_scope_rows = (
        await session.execute(
            select(ScopeItem).where(ScopeItem.engagement_id == engagement_id, ScopeItem.in_scope.is_(True))
        )
    ).scalars().all()
    out_scope_rows = (
        await session.execute(
            select(ScopeItem).where(ScopeItem.engagement_id == engagement_id, ScopeItem.in_scope.is_(False))
        )
    ).scalars().all()

    normalized_targets = [v.lower().strip() for v in target_values if v]

    for row in out_scope_rows:
        needle = row.value.lower().strip()
        if needle and any(needle in t for t in normalized_targets):
            return False, f"Target matches out-of-scope rule: {row.value}"

    if not in_scope_rows:
        return True, None

    for row in in_scope_rows:
        needle = row.value.lower().strip()
        if needle and any(needle in t for t in normalized_targets):
            return True, None

    return False, "Target does not match any in-scope rule"


def parse_url_for_endpoint(url: str) -> tuple[str, str, str | None]:
    parsed = urlparse(url)
    host = parsed.hostname or parsed.netloc
    path = parsed.path or "/"
    query = parsed.query or None
    return host, path, query


def calculate_runtime(started_at: datetime | None, ended_at: datetime | None) -> float | None:
    if not started_at or not ended_at:
        return None
    return max((ended_at - started_at).total_seconds(), 0.0)
