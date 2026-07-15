"""Clients API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.client import Client
from backend.app.schemas.schemas import ClientCreate, ClientRead, ClientUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()

@router.get("", response_model=list[ClientRead])
async def list_clients(
    q: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if is_active is not None:
        filters.append(Client.is_active == is_active)
    if q:
        filters.append(Client.name.ilike(f"%{q}%"))
    rows, _ = await list_all(session, Client, filters, skip, limit, Client.name)
    return rows

@router.post("", response_model=ClientRead, status_code=201)
async def create_client(body: ClientCreate, session: AsyncSession = Depends(get_session)):
    data = body.model_dump(exclude={"contacts"})
    obj = await create_obj(session, Client, data)
    if body.contacts:
        from backend.app.models.client import ClientContact
        for c in body.contacts:
            await create_obj(session, ClientContact, {**c.model_dump(), "client_id": obj.id})
    await session.refresh(obj)
    return obj

@router.get("/{client_id}", response_model=ClientRead)
async def get_client(client_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Client, client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    return obj

@router.patch("/{client_id}", response_model=ClientRead)
async def update_client(client_id: str, body: ClientUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Client, client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{client_id}", status_code=204)
async def delete_client(client_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Client, client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    await delete_obj(session, obj)
