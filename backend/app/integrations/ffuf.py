"""ffuf JSON importer."""
from __future__ import annotations
import json, logging
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.scan import ScanImport, ScanResult
from backend.app.utils.crud import create_obj
from backend.app.models.base import utcnow

logger = logging.getLogger(__name__)


async def import_ffuf(session: AsyncSession, scan_import: ScanImport, content: bytes) -> None:
    data = json.loads(content)
    results = data.get("results", [])
    for r in results:
        await create_obj(session, ScanResult, {
            "scan_import_id": scan_import.id,
            "result_type": "url",
            "title": r.get("url", ""),
            "data_json": json.dumps(r),
        })
    scan_import.status = "complete"
    scan_import.imported_at = utcnow()
