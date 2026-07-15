"""Payloads API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.payload import Payload
from backend.app.schemas.schemas import PayloadCreate, PayloadRead, PayloadUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.models.base import utcnow

router = APIRouter()

@router.get("", response_model=list[PayloadRead])
async def list_payloads(
    category: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if category: filters.append(Payload.category == category)
    if language: filters.append(Payload.language == language)
    if is_favorite is not None: filters.append(Payload.is_favorite == is_favorite)
    if q: filters.append(Payload.name.ilike(f"%{q}%"))
    rows, _ = await list_all(session, Payload, filters, skip, limit, Payload.name)
    return rows

@router.post("", response_model=PayloadRead, status_code=201)
async def create_payload(body: PayloadCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Payload, body.model_dump())

@router.get("/{payload_id}", response_model=PayloadRead)
async def get_payload(payload_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Payload, payload_id)
    if not obj: raise HTTPException(404, "Payload not found")
    return obj

@router.patch("/{payload_id}", response_model=PayloadRead)
async def update_payload(payload_id: str, body: PayloadUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Payload, payload_id)
    if not obj: raise HTTPException(404, "Payload not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.post("/{payload_id}/use", response_model=PayloadRead)
async def record_use(payload_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Payload, payload_id)
    if not obj: raise HTTPException(404, "Payload not found")
    return await update_obj(session, obj, {"last_used": utcnow()})

@router.delete("/{payload_id}", status_code=204)
async def delete_payload(payload_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Payload, payload_id)
    if not obj: raise HTTPException(404, "Payload not found")
    await delete_obj(session, obj)
