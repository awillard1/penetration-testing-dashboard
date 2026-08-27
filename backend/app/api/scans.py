"""Scan imports API."""
from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.database import get_session
from backend.app.models.scan import ScanImport, ScanResult
from backend.app.schemas.schemas import ScanImportRead
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()


class ScanImportUpdateBody(BaseModel):
    notes: str | None = None

@router.get("", response_model=list[ScanImportRead])
async def list_scans(
    engagement_id: str | None = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id:
        filters.append(ScanImport.engagement_id == engagement_id)
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
        header = content[:4096]
        scan_type = (
            "nuclei"
            if b'"template-id"' in header
            else (
                "ffuf"
                if b'"commandline"' in header
                else (
                    "generic_json"
                    if any(
                        marker in header
                        for marker in [
                            b'"nmap"',
                            b'"openvas"',
                            b'"nessus"',
                            b'"gobuster"',
                            b'"ferox"',
                            b'"hashcat"',
                            b'"john"',
                            b'"burp"',
                        ]
                    )
                    else "json"
                )
            )
        )
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

        await run_importer(session, obj, content)
        await session.flush()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Importer error: %s", e)

    return obj

@router.get("/{scan_id}", response_model=ScanImportRead)
async def get_scan(scan_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScanImport, scan_id)
    if not obj:
        raise HTTPException(404, "Scan not found")
    return obj


@router.get("/{scan_id}/detail")
async def get_scan_detail(scan_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScanImport, scan_id)
    if not obj:
        raise HTTPException(404, "Scan not found")

    results = (
        await session.execute(
            select(ScanResult).where(ScanResult.scan_import_id == scan_id).order_by(ScanResult.created_at.desc()).limit(200)
        )
    ).scalars().all()
    return {
        "id": obj.id,
        "engagement_id": obj.engagement_id,
        "filename": obj.filename,
        "scan_type": obj.scan_type,
        "status": obj.status,
        "sha256": obj.sha256,
        "imported_targets": obj.imported_targets,
        "imported_findings": obj.imported_findings,
        "error_count": obj.error_count,
        "error_log": obj.error_log,
        "notes": obj.notes,
        "imported_at": obj.imported_at,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
        "results": [
            {
                "id": row.id,
                "result_type": row.result_type,
                "title": row.title,
                "severity": row.severity,
                "target_id": row.target_id,
                "finding_id": row.finding_id,
                "is_duplicate": row.is_duplicate,
                "data_json": row.data_json,
                "created_at": row.created_at,
            }
            for row in results
        ],
    }


@router.patch("/{scan_id}", response_model=ScanImportRead)
async def update_scan(scan_id: str, body: ScanImportUpdateBody, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScanImport, scan_id)
    if not obj:
        raise HTTPException(404, "Scan not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{scan_id}", status_code=204)
async def delete_scan(scan_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScanImport, scan_id)
    if not obj:
        raise HTTPException(404, "Scan not found")
    await delete_obj(session, obj)
