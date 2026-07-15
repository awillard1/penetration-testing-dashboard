"""Scan file importers."""
from __future__ import annotations

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.scan import ScanImport

logger = logging.getLogger(__name__)


async def run_importer(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    """Dispatch to the appropriate importer based on scan type."""
    scan_type = scan_import.scan_type
    try:
        if scan_type == "nmap_xml":
            from backend.app.integrations.nmap import import_nmap
            await import_nmap(session, scan_import, content)
        elif scan_type == "nessus":
            from backend.app.integrations.nessus import import_nessus
            await import_nessus(session, scan_import, content)
        elif scan_type == "nuclei":
            from backend.app.integrations.nuclei import import_nuclei
            await import_nuclei(session, scan_import, content)
        elif scan_type == "ffuf":
            from backend.app.integrations.ffuf import import_ffuf
            await import_ffuf(session, scan_import, content)
        elif scan_type in ("burp_xml",):
            from backend.app.integrations.burp import import_burp
            await import_burp(session, scan_import, content)
        else:
            scan_import.status = "unsupported"
    except Exception as exc:
        logger.warning("Importer error for %s: %s", scan_type, exc)
        scan_import.status = "error"
        scan_import.error_log = str(exc)
        scan_import.error_count += 1
