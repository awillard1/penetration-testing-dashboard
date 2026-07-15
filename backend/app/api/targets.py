"""Targets API."""
from __future__ import annotations
from typing import Optional
import csv, io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.target import Target
from backend.app.schemas.schemas import TargetCreate, TargetRead, TargetUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()

@router.get("", response_model=list[TargetRead])
async def list_targets(
    engagement_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    in_scope: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Target.engagement_id == engagement_id)
    if in_scope is not None: filters.append(Target.in_scope == in_scope)
    if q:
        from sqlalchemy import or_
        filters.append(or_(Target.hostname.ilike(f"%{q}%"), Target.ip_address.ilike(f"%{q}%")))
    rows, _ = await list_all(session, Target, filters, skip, limit)
    return rows

@router.post("", response_model=TargetRead, status_code=201)
async def create_target(body: TargetCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Target, body.model_dump())

@router.get("/{target_id}", response_model=TargetRead)
async def get_target(target_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Target, target_id)
    if not obj: raise HTTPException(404, "Target not found")
    return obj

@router.patch("/{target_id}", response_model=TargetRead)
async def update_target(target_id: str, body: TargetUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Target, target_id)
    if not obj: raise HTTPException(404, "Target not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{target_id}", status_code=204)
async def delete_target(target_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Target, target_id)
    if not obj: raise HTTPException(404, "Target not found")
    await delete_obj(session, obj)

@router.get("/export/csv")
async def export_targets_csv(engagement_id: Optional[str] = Query(None), session: AsyncSession = Depends(get_session)):
    filters = []
    if engagement_id: filters.append(Target.engagement_id == engagement_id)
    rows, _ = await list_all(session, Target, filters, 0, 10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id","hostname","ip_address","port","protocol","url","os","environment","in_scope","tags"])
    for r in rows:
        writer.writerow([r.id, r.hostname, r.ip_address, r.port, r.protocol, r.url, r.operating_system, r.environment, r.in_scope, r.tags])
    output.seek(0)
    return StreamingResponse(io.BytesIO(output.getvalue().encode()), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=targets.csv"})
