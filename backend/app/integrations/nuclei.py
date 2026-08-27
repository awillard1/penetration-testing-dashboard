"""Nuclei JSON/JSONL importer."""
from __future__ import annotations

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import utcnow
from backend.app.models.finding import Finding
from backend.app.models.scan import ScanImport
from backend.app.services.operator_assets import create_web_artifacts, parse_url_for_endpoint
from backend.app.utils.crud import create_obj

logger = logging.getLogger(__name__)
SEV_MAP = {"info": "informational", "low": "low", "medium": "medium", "high": "high", "critical": "critical"}


async def import_nuclei(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    text = content.decode("utf-8", errors="replace")
    findings_count = 0
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        title = item.get("info", {}).get("name") or item.get("template-id", "Unknown")
        severity = SEV_MAP.get(item.get("info", {}).get("severity", "info").lower(), "informational")
        matched = item.get("matched-at") or item.get("host", "")
        desc = item.get("info", {}).get("description", "")
        data = {
            "engagement_id": scan_import.engagement_id,
            "title": title,
            "description": desc,
            "affected_endpoints": matched,
            "severity": severity,
            "status": "draft",
        }
        await create_obj(session, Finding, data)
        if matched.startswith("http://") or matched.startswith("https://"):
            host, path, query = parse_url_for_endpoint(matched)
            await create_web_artifacts(
                session,
                engagement_id=scan_import.engagement_id,
                target_id=None,
                host=host or "unknown-host",
                ip_address=None,
                url=matched,
                method="GET",
                path=path,
                query_params=query,
                source_tool="nuclei",
                discovered_by="nuclei_import",
            )
        findings_count += 1
    scan_import.status = "complete"
    scan_import.imported_findings = findings_count
    scan_import.imported_at = utcnow()
