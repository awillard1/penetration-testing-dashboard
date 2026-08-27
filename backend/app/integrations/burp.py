"""Burp Suite XML importer."""
from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import utcnow
from backend.app.models.finding import Finding
from backend.app.models.operator import HttpMessage
from backend.app.models.scan import ScanImport
from backend.app.services.operator_assets import create_web_artifacts
from backend.app.utils.crud import create_obj

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
        path = issue.findtext("path") or "/"
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
        if host.startswith("http://") or host.startswith("https://"):
            endpoint = await create_web_artifacts(
                session,
                engagement_id=scan_import.engagement_id,
                target_id=None,
                host=host.split("://", 1)[-1].split("/", 1)[0],
                ip_address=None,
                url=host,
                method="GET",
                path=path,
                source_tool="burp",
                discovered_by="burp_xml_import",
            )
            session.add(
                HttpMessage(
                    engagement_id=scan_import.engagement_id,
                    endpoint_id=endpoint.id,
                    method="GET",
                    path=path,
                    source_tool="burp",
                    request_raw=issue.findtext("request"),
                    response_raw=issue.findtext("response"),
                )
            )
        findings_count += 1
    scan_import.status = "complete"
    scan_import.imported_findings = findings_count
    scan_import.imported_at = utcnow()
