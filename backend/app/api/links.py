"""Links API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.link import Link, LinkCollection
from backend.app.schemas.schemas import LinkCreate, LinkRead, LinkUpdate, LinkCollectionCreate, LinkCollectionRead
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.models.base import utcnow

router = APIRouter()

@router.get("", response_model=list[LinkRead])
async def list_links(
    engagement_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Link.engagement_id == engagement_id)
    if category: filters.append(Link.category == category)
    if is_favorite is not None: filters.append(Link.is_favorite == is_favorite)
    if q:
        from sqlalchemy import or_
        filters.append(or_(Link.name.ilike(f"%{q}%"), Link.url.ilike(f"%{q}%")))
    rows, _ = await list_all(session, Link, filters, skip, limit, Link.display_order)
    return rows

@router.post("", response_model=LinkRead, status_code=201)
async def create_link(body: LinkCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Link, body.model_dump())

@router.get("/collections", response_model=list[LinkCollectionRead])
async def list_collections(session: AsyncSession = Depends(get_session)):
    rows, _ = await list_all(session, LinkCollection, [], 0, 200, LinkCollection.display_order)
    return rows

@router.post("/collections", response_model=LinkCollectionRead, status_code=201)
async def create_collection(body: LinkCollectionCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, LinkCollection, body.model_dump())

@router.get("/{link_id}", response_model=LinkRead)
async def get_link(link_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Link, link_id)
    if not obj: raise HTTPException(404, "Link not found")
    return obj

@router.patch("/{link_id}", response_model=LinkRead)
async def update_link(link_id: str, body: LinkUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Link, link_id)
    if not obj: raise HTTPException(404, "Link not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.post("/{link_id}/open", response_model=LinkRead)
async def record_link_open(link_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Link, link_id)
    if not obj: raise HTTPException(404, "Link not found")
    return await update_obj(session, obj, {"last_opened": utcnow(), "open_count": (obj.open_count or 0) + 1})

@router.delete("/{link_id}", status_code=204)
async def delete_link(link_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Link, link_id)
    if not obj: raise HTTPException(404, "Link not found")
    await delete_obj(session, obj)
