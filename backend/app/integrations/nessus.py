"""Nessus .nessus importer."""
from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import utcnow
from backend.app.models.finding import Finding
from backend.app.models.scan import ScanImport
from backend.app.models.target import Target
from backend.app.services.operator_assets import get_or_create_host, get_or_create_service
from backend.app.utils.crud import create_obj

logger = logging.getLogger(__name__)

SEVERITY_MAP = {"0": "informational", "1": "low", "2": "medium", "3": "high", "4": "critical"}


async def import_nessus(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    import defusedxml.ElementTree as ET
    root = ET.fromstring(content)
    target_count = 0
    finding_count = 0
    for report in root.findall(".//Report"):
        for host in report.findall("ReportHost"):
            ip = host.get("name", "")
            hostname = None
            for tag in host.findall("HostProperties/tag"):
                if tag.get("name") == "host-fqdn":
                    hostname = tag.text
                    break
            target_data = {
                "engagement_id": scan_import.engagement_id,
                "ip_address": ip,
                "hostname": hostname,
                "source": "nessus",
                "first_seen": utcnow(),
                "last_seen": utcnow(),
            }
            target = await create_obj(session, Target, target_data)
            host_row = await get_or_create_host(
                session,
                engagement_id=scan_import.engagement_id,
                target_id=target.id,
                hostname=hostname,
                ip_address=ip,
                source_tool="nessus",
                discovered_by="nessus_import",
            )
            target_count += 1
            for item in host.findall("ReportItem"):
                sev_int = item.get("severity", "0")
                severity = SEVERITY_MAP.get(sev_int, "informational")
                if severity == "informational":
                    continue
                title = item.get("pluginName", "Unknown")
                description = (item.findtext("description") or "").strip()
                solution = (item.findtext("solution") or "").strip()
                finding_data = {
                    "engagement_id": scan_import.engagement_id,
                    "title": title,
                    "description": description,
                    "remediation": solution,
                    "severity": severity,
                    "status": "draft",
                    "source": "nessus",
                }
                await create_obj(session, Finding, finding_data)
                try:
                    port_value = int(item.get("port", "0"))
                except ValueError:
                    port_value = None
                await get_or_create_service(
                    session,
                    engagement_id=scan_import.engagement_id,
                    host_id=host_row.id,
                    port=port_value,
                    protocol=item.get("protocol"),
                    service_name=item.get("svc_name"),
                    source_tool="nessus",
                    discovered_by="nessus_import",
                )
                finding_count += 1
    scan_import.status = "complete"
    scan_import.imported_targets = target_count
    scan_import.imported_findings = finding_count
    scan_import.imported_at = utcnow()
