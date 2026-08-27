"""Generic JSON/CSV-style importer foundation with adaptable mapping."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import utcnow
from backend.app.models.scan import ScanImport
from backend.app.services.operator_assets import create_web_artifacts


def _as_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [i for i in payload if isinstance(i, dict)]
    if isinstance(payload, dict):
        for key in ["results", "items", "data", "records", "endpoints"]:
            val = payload.get(key)
            if isinstance(val, list):
                return [i for i in val if isinstance(i, dict)]
        return [payload]
    return []


async def import_generic_json(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    payload = json.loads(content.decode("utf-8", errors="replace"))
    records = _as_list(payload)
    imported = 0

    for item in records:
        url = item.get("url") or item.get("endpoint") or item.get("uri")
        host = item.get("host") or item.get("hostname")
        if not url and host:
            path = item.get("path") or "/"
            scheme = item.get("scheme") or "https"
            url = f"{scheme}://{host}{path}"
        if not url:
            continue

        method = str(item.get("method") or "GET").upper()
        parsed_path = item.get("path") or "/"
        if parsed_path == "/" and "://" in url:
            parsed_path = "/" + url.split("/", 3)[-1] if url.count("/") >= 3 else "/"
            if not parsed_path.startswith("/"):
                parsed_path = f"/{parsed_path}"

        await create_web_artifacts(
            session,
            engagement_id=scan_import.engagement_id,
            target_id=None,
            host=host or "unknown-host",
            ip_address=item.get("ip") or item.get("ip_address"),
            url=url,
            method=method,
            path=parsed_path,
            query_params=item.get("query") or item.get("query_params"),
            body_params=item.get("body_params"),
            content_type=item.get("content_type"),
            status_code=item.get("status_code"),
            auth_requirement=item.get("auth_requirement"),
            source_tool=item.get("tool") or "generic_json",
            discovered_by=item.get("discovered_by") or "generic_import",
        )
        imported += 1

    scan_import.status = "complete"
    scan_import.imported_targets = imported
    scan_import.imported_at = utcnow()
