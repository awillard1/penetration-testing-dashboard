"""Scope API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.scope import ScopeItem
from backend.app.schemas.schemas import ScopeItemCreate, ScopeItemRead, ScopeItemUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()

@router.get("", response_model=list[ScopeItemRead])
async def list_scope(
    engagement_id: Optional[str] = Query(None),
    in_scope: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id:
        filters.append(ScopeItem.engagement_id == engagement_id)
    if in_scope is not None:
        filters.append(ScopeItem.in_scope == in_scope)
    rows, _ = await list_all(session, ScopeItem, filters, skip, limit)
    return rows

@router.post("", response_model=ScopeItemRead, status_code=201)
async def create_scope_item(body: ScopeItemCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, ScopeItem, body.model_dump())

@router.get("/{item_id}", response_model=ScopeItemRead)
async def get_scope_item(item_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScopeItem, item_id)
    if not obj: raise HTTPException(404, "Scope item not found")
    return obj

@router.patch("/{item_id}", response_model=ScopeItemRead)
async def update_scope_item(item_id: str, body: ScopeItemUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScopeItem, item_id)
    if not obj: raise HTTPException(404, "Scope item not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{item_id}", status_code=204)
async def delete_scope_item(item_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, ScopeItem, item_id)
    if not obj: raise HTTPException(404, "Scope item not found")
    await delete_obj(session, obj)
