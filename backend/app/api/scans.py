"""Scan imports API."""
from __future__ import annotations
from typing import Optional
from pathlib import Path
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.scan import ScanImport
from backend.app.schemas.schemas import ScanImportRead
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all
from backend.app.config import settings
from backend.app.models.base import utcnow

router = APIRouter()

@router.get("", response_model=list[ScanImportRead])
async def list_scans(
    engagement_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(ScanImport.engagement_id == engagement_id)
    rows, _ = await list_all(session, ScanImport, filters, skip, limit, ScanImport.created_at.desc())
    return rows

@router.post("/upload", response_model=ScanImportRead, status_code=201)
async def upload_scan(
    engagement_id: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if file.size and file.size > settings.max_upload_size:
        raise HTTPException(413, "File too large")
    safe_name = Path(file.filename or "scan").name
    content = await file.read()
    sha = hashlib.sha256(content).hexdigest()
    dest_dir = settings.import_dir / engagement_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{sha[:16]}_{safe_name}"
    dest.write_bytes(content)

    # Detect type
    scan_type = "unknown"
    if safe_name.endswith(".xml"):
        scan_type = "nmap_xml" if b"<nmaprun" in content[:2048] else ("nessus" if b"<NessusClientData" in content[:2048] else ("burp_xml" if b"<issues>" in content[:2048] else "xml"))
    elif safe_name.endswith(".nessus"):
        scan_type = "nessus"
    elif safe_name.endswith(".json") or safe_name.endswith(".jsonl"):
        scan_type = "nuclei" if b'"template-id"' in content[:2048] else ("ffuf" if b'"commandline"' in content[:2048] else "json")
    elif safe_name.endswith(".csv"):
        scan_type = "csv"

    obj = await create_obj(session, ScanImport, {
        "engagement_id": engagement_id,
        "filename": safe_name,
        "file_path": str(dest),
        "scan_type": scan_type,
        "status": "pending",
        "sha256": sha,
    })

    # Run importer asynchronously
    try:
        from backend.app.integrations import run_importer
        result = await run_importer(session, obj, content)
        await session.flush()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Importer error: %s", e)

    return obj

@router.get("/{scan_id}", response_model=ScanImportRead)
async def get_scan(scan_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScanImport, scan_id)
    if not obj: raise HTTPException(404, "Scan not found")
    return obj

@router.delete("/{scan_id}", status_code=204)
async def delete_scan(scan_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScanImport, scan_id)
    if not obj: raise HTTPException(404, "Scan not found")
    await delete_obj(session, obj)
