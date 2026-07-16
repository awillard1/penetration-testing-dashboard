"""Backups API."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.backup import Backup
from backend.app.schemas.schemas import BackupRead
from backend.app.utils.crud import get_by_id, list_all

router = APIRouter()

@router.get("", response_model=list[BackupRead])
async def list_backups(
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    rows, _ = await list_all(session, Backup, [], skip, limit, Backup.created_at.desc())
    return rows

@router.post("/create", response_model=BackupRead, status_code=201)
async def create_backup(session: AsyncSession = Depends(get_session)):
    from backend.app.workers.backups import run_backup
    obj = await run_backup(session)
    return obj

@router.get("/{backup_id}", response_model=BackupRead)
async def get_backup(backup_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Backup, backup_id)
    if not obj: raise HTTPException(404, "Backup not found")
    return obj

@router.get("/{backup_id}/download")
async def download_backup(backup_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Backup, backup_id)
    if not obj or not obj.file_path: raise HTTPException(404, "Backup not found")
    from pathlib import Path
    from backend.app.config import settings
    p = Path(obj.file_path).resolve()
    backup_dir = settings.backup_dir.resolve()
    # Ensure the file is within the expected backups directory (prevent path traversal)
    try:
        p.relative_to(backup_dir)
    except ValueError:
        raise HTTPException(403, "Access denied")
    if not p.exists(): raise HTTPException(404, "Backup file missing from disk")
    return FileResponse(str(p), filename=p.name, media_type="application/zip")
