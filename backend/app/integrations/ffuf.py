"""ffuf JSON importer."""
from __future__ import annotations

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import utcnow
from backend.app.models.scan import ScanImport, ScanResult
from backend.app.services.operator_assets import create_web_artifacts, parse_url_for_endpoint
from backend.app.utils.crud import create_obj

logger = logging.getLogger(__name__)


async def import_ffuf(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    data = json.loads(content)
    results = data.get("results", [])
    for r in results:
        url = r.get("url", "")
        if url:
            host, path, query = parse_url_for_endpoint(url)
            await create_web_artifacts(
                session,
                engagement_id=scan_import.engagement_id,
                target_id=None,
                host=host or "unknown-host",
                ip_address=None,
                url=url,
                method="GET",
                path=path,
                query_params=query,
                status_code=r.get("status"),
                source_tool="ffuf",
                discovered_by="ffuf_import",
            )
        await create_obj(session, ScanResult, {
            "scan_import_id": scan_import.id,
            "result_type": "url",
            "title": url,
            "data_json": json.dumps(r),
        })
    scan_import.status = "complete"
    scan_import.imported_at = utcnow()
