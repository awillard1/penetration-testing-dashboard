"""Reports API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.report import Report
from backend.app.schemas.schemas import ReportCreate, ReportRead
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.models.base import utcnow

router = APIRouter()

@router.get("", response_model=list[ReportRead])
async def list_reports(
    engagement_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Report.engagement_id == engagement_id)
    rows, _ = await list_all(session, Report, filters, skip, limit, Report.created_at.desc())
    return rows

@router.post("/generate", response_model=ReportRead, status_code=201)
async def generate_report(body: ReportCreate, session: AsyncSession = Depends(get_session)):
    from backend.app.reporting.builders import build_report
    obj = await create_obj(session, Report, {**body.model_dump(), "status": "generating", "is_draft": True})
    try:
        file_path = await build_report(session, obj)
        await update_obj(session, obj, {"file_path": str(file_path), "status": "complete", "generated_at": utcnow()})
    except Exception as e:
        await update_obj(session, obj, {"status": "failed"})
        raise HTTPException(500, f"Report generation failed: {e}")
    return obj

@router.get("/{report_id}", response_model=ReportRead)
async def get_report(report_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Report, report_id)
    if not obj: raise HTTPException(404, "Report not found")
    return obj

@router.get("/{report_id}/download")
async def download_report(report_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Report, report_id)
    if not obj or not obj.file_path: raise HTTPException(404, "Report file not found")
    from pathlib import Path
    p = Path(obj.file_path)
    if not p.exists(): raise HTTPException(404, "Report file missing from disk")
    return FileResponse(str(p), filename=p.name)

@router.delete("/{report_id}", status_code=204)
async def delete_report(report_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Report, report_id)
    if not obj: raise HTTPException(404, "Report not found")
    await delete_obj(session, obj)
