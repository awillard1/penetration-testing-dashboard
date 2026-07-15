"""Nmap XML importer."""
from __future__ import annotations
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.scan import ScanImport, ScanResult
from backend.app.models.target import Target
from backend.app.utils.crud import create_obj
from backend.app.models.base import utcnow

logger = logging.getLogger(__name__)


async def import_nmap(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    import defusedxml.ElementTree as ET
    root = ET.fromstring(content)
    target_count = 0
    for host in root.findall("host"):
        state = host.find("status")
        if state is None or state.get("state") != "up":
            continue
        address = host.find("address")
        ip = address.get("addr") if address is not None else None
        hostname_el = host.find("hostnames/hostname")
        hostname = hostname_el.get("name") if hostname_el is not None else None
        os_el = host.find("os/osmatch")
        os_name = os_el.get("name") if os_el is not None else None

        ports = host.findall("ports/port")
        if not ports:
            # Create host-only target
            data = {
                "engagement_id": scan_import.engagement_id,
                "ip_address": ip,
                "hostname": hostname,
                "operating_system": os_name,
                "source": "nmap",
                "first_seen": utcnow(),
                "last_seen": utcnow(),
            }
            await create_obj(session, Target, data)
            await create_obj(session, ScanResult, {
                "scan_import_id": scan_import.id,
                "result_type": "host",
                "title": hostname or ip,
            })
            target_count += 1
        else:
            for port in ports:
                state_el = port.find("state")
                if state_el is None or state_el.get("state") != "open":
                    continue
                portid = int(port.get("portid", 0))
                protocol = port.get("protocol", "tcp")
                service_el = port.find("service")
                service_name = service_el.get("name", "") if service_el is not None else ""
                data = {
                    "engagement_id": scan_import.engagement_id,
                    "ip_address": ip,
                    "hostname": hostname,
                    "port": portid,
                    "protocol": protocol,
                    "operating_system": os_name,
                    "technology": service_name,
                    "source": "nmap",
                    "first_seen": utcnow(),
                    "last_seen": utcnow(),
                }
                await create_obj(session, Target, data)
                target_count += 1

    scan_import.status = "complete"
    scan_import.imported_targets = target_count
    scan_import.imported_at = utcnow()
