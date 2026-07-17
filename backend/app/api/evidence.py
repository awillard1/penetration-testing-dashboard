"""Evidence API."""
from __future__ import annotations
import hashlib, os, shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.evidence import Evidence
from backend.app.schemas.schemas import EvidenceCreate, EvidenceRead, EvidenceUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.config import settings

router = APIRouter()

@router.get("", response_model=list[EvidenceRead])
async def list_evidence(
    engagement_id: Optional[str] = Query(None),
    finding_id: Optional[str] = Query(None),
    evidence_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Evidence.engagement_id == engagement_id)
    if evidence_type: filters.append(Evidence.evidence_type == evidence_type)
    if finding_id:
        from backend.app.models.finding import FindingEvidence
        from sqlalchemy import select
        fe_ids = (await session.execute(
            select(FindingEvidence.evidence_id).where(FindingEvidence.finding_id == finding_id)
        )).scalars().all()
        filters.append(Evidence.id.in_(fe_ids))
    rows, _ = await list_all(session, Evidence, filters, skip, limit, Evidence.created_at.desc())
    return rows

@router.post("", response_model=EvidenceRead, status_code=201)
async def create_evidence(body: EvidenceCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Evidence, body.model_dump())

@router.post("/upload", response_model=EvidenceRead, status_code=201)
async def upload_evidence(
    engagement_id: str,
    title: str,
    evidence_type: str = "file",
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if file.size and file.size > settings.max_upload_size:
        raise HTTPException(413, "File too large")
    # Sanitize filename
    safe_name = Path(file.filename or "upload").name
    dest_dir = settings.attachment_dir / engagement_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    sha = hashlib.sha256(content).hexdigest()
    dest = dest_dir / f"{sha[:16]}_{safe_name}"
    dest.write_bytes(content)
    data = {
        "engagement_id": engagement_id,
        "title": title,
        "evidence_type": evidence_type,
        "file_path": str(dest),
        "original_filename": safe_name,
        "mime_type": file.content_type,
        "file_size": len(content),
        "sha256": sha,
    }
    return await create_obj(session, Evidence, data)

@router.get("/{ev_id}", response_model=EvidenceRead)
async def get_evidence(ev_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj: raise HTTPException(404, "Evidence not found")
    return obj

@router.get("/{ev_id}/download")
async def download_evidence(ev_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj:
        raise HTTPException(404, "Evidence not found")
    if not obj.file_path:
        raise HTTPException(404, "No file available for this evidence item")
    file_path = Path(obj.file_path).resolve()
    if settings.attachment_dir.resolve() not in file_path.parents:
        raise HTTPException(403, "Invalid file path")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(404, "Evidence file not found")
    return FileResponse(
        path=file_path,
        media_type=obj.mime_type or "application/octet-stream",
        filename=obj.original_filename or file_path.name,
    )

@router.patch("/{ev_id}", response_model=EvidenceRead)
async def update_evidence(ev_id: str, body: EvidenceUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj: raise HTTPException(404, "Evidence not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{ev_id}", status_code=204)
async def delete_evidence(ev_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj: raise HTTPException(404, "Evidence not found")
    await delete_obj(session, obj)
