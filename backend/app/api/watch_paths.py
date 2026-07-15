"""Watch paths API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.watch_path import WatchPath
from backend.app.schemas.schemas import WatchPathCreate, WatchPathRead, WatchPathUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()

@router.get("", response_model=list[WatchPathRead])
async def list_watch_paths(
    engagement_id: Optional[str] = Query(None),
    is_enabled: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(WatchPath.engagement_id == engagement_id)
    if is_enabled is not None: filters.append(WatchPath.is_enabled == is_enabled)
    rows, _ = await list_all(session, WatchPath, filters, 0, 200)
    return rows

@router.post("", response_model=WatchPathRead, status_code=201)
async def create_watch_path(body: WatchPathCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, WatchPath, body.model_dump())

@router.get("/{wp_id}", response_model=WatchPathRead)
async def get_watch_path(wp_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, WatchPath, wp_id)
    if not obj: raise HTTPException(404, "Watch path not found")
    return obj

@router.patch("/{wp_id}", response_model=WatchPathRead)
async def update_watch_path(wp_id: str, body: WatchPathUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, WatchPath, wp_id)
    if not obj: raise HTTPException(404, "Watch path not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{wp_id}", status_code=204)
async def delete_watch_path(wp_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, WatchPath, wp_id)
    if not obj: raise HTTPException(404, "Watch path not found")
    await delete_obj(session, obj)
