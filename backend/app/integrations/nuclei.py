"""Nuclei JSON/JSONL importer."""
from __future__ import annotations
import json, logging
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.scan import ScanImport
from backend.app.models.finding import Finding
from backend.app.utils.crud import create_obj
from backend.app.models.base import utcnow

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
        findings_count += 1
    scan_import.status = "complete"
    scan_import.imported_findings = findings_count
    scan_import.imported_at = utcnow()
