"""Burp Suite XML importer."""
from __future__ import annotations
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.scan import ScanImport
from backend.app.models.finding import Finding
from backend.app.utils.crud import create_obj
from backend.app.models.base import utcnow

logger = logging.getLogger(__name__)
SEV_MAP = {"information": "informational", "low": "low", "medium": "medium", "high": "high"}


async def import_burp(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    import defusedxml.ElementTree as ET
    root = ET.fromstring(content)
    findings_count = 0
    for issue in root.findall(".//issue"):
        name = issue.findtext("name") or "Unknown"
        sev = SEV_MAP.get((issue.findtext("severity") or "").lower(), "informational")
        detail = issue.findtext("issueDetail") or ""
        bg = issue.findtext("issueBackground") or ""
        remediation = issue.findtext("remediationBackground") or ""
        host = issue.findtext("host") or ""
        data = {
            "engagement_id": scan_import.engagement_id,
            "title": name,
            "description": f"{bg}\n\n{detail}".strip(),
            "remediation": remediation,
            "affected_endpoints": host,
            "severity": sev,
            "status": "draft",
        }
        await create_obj(session, Finding, data)
        findings_count += 1
    scan_import.status = "complete"
    scan_import.imported_findings = findings_count
    scan_import.imported_at = utcnow()
