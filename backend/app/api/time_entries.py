"""Time entries API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.time_entry import TimeEntry
from backend.app.schemas.schemas import TimeEntryCreate, TimeEntryRead, TimeEntryUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.models.base import utcnow

router = APIRouter()

@router.get("", response_model=list[TimeEntryRead])
async def list_time_entries(
    engagement_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(TimeEntry.engagement_id == engagement_id)
    if is_active is not None: filters.append(TimeEntry.is_active == is_active)
    rows, _ = await list_all(session, TimeEntry, filters, skip, limit, TimeEntry.created_at.desc())
    return rows

@router.post("", response_model=TimeEntryRead, status_code=201)
async def create_time_entry(body: TimeEntryCreate, session: AsyncSession = Depends(get_session)):
    data = body.model_dump()
    return await create_obj(session, TimeEntry, data)

@router.post("/{entry_id}/start", response_model=TimeEntryRead)
async def start_timer(entry_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, TimeEntry, entry_id)
    if not obj: raise HTTPException(404, "Time entry not found")
    return await update_obj(session, obj, {"start_time": utcnow(), "is_active": True})

@router.post("/{entry_id}/stop", response_model=TimeEntryRead)
async def stop_timer(entry_id: str, session: AsyncSession = Depends(get_session)):
    import math
    obj = await get_by_id(session, TimeEntry, entry_id)
    if not obj: raise HTTPException(404, "Time entry not found")
    now = utcnow()
    duration = None
    if obj.start_time:
        delta = now - obj.start_time
        duration = math.ceil(delta.total_seconds() / 60)
    return await update_obj(session, obj, {"end_time": now, "is_active": False, "duration_minutes": duration})

@router.patch("/{entry_id}", response_model=TimeEntryRead)
async def update_time_entry(entry_id: str, body: TimeEntryUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, TimeEntry, entry_id)
    if not obj: raise HTTPException(404, "Time entry not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{entry_id}", status_code=204)
async def delete_time_entry(entry_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, TimeEntry, entry_id)
    if not obj: raise HTTPException(404, "Time entry not found")
    await delete_obj(session, obj)
