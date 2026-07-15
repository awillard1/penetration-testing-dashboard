"""Findings API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.finding import Finding, FindingTemplate
from backend.app.schemas.schemas import (
    FindingCreate, FindingRead, FindingUpdate,
    FindingTemplateCreate, FindingTemplateRead, FindingTemplateUpdate,
)
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()

@router.get("", response_model=list[FindingRead])
async def list_findings(
    engagement_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Finding.engagement_id == engagement_id)
    if severity: filters.append(Finding.severity == severity)
    if status: filters.append(Finding.status == status)
    if q: filters.append(Finding.title.ilike(f"%{q}%"))
    rows, _ = await list_all(session, Finding, filters, skip, limit, Finding.created_at.desc())
    return rows

@router.post("", response_model=FindingRead, status_code=201)
async def create_finding(body: FindingCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Finding, body.model_dump())

@router.get("/templates", response_model=list[FindingTemplateRead])
async def list_templates(
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if category: filters.append(FindingTemplate.category == category)
    if q: filters.append(FindingTemplate.title.ilike(f"%{q}%"))
    rows, _ = await list_all(session, FindingTemplate, filters, skip, limit, FindingTemplate.title)
    return rows

@router.post("/templates", response_model=FindingTemplateRead, status_code=201)
async def create_template(body: FindingTemplateCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, FindingTemplate, body.model_dump())

@router.get("/templates/{tmpl_id}", response_model=FindingTemplateRead)
async def get_template(tmpl_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, FindingTemplate, tmpl_id)
    if not obj: raise HTTPException(404, "Template not found")
    return obj

@router.patch("/templates/{tmpl_id}", response_model=FindingTemplateRead)
async def update_template(tmpl_id: str, body: FindingTemplateUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, FindingTemplate, tmpl_id)
    if not obj: raise HTTPException(404, "Template not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/templates/{tmpl_id}", status_code=204)
async def delete_template(tmpl_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, FindingTemplate, tmpl_id)
    if not obj: raise HTTPException(404, "Template not found")
    await delete_obj(session, obj)

@router.get("/{finding_id}", response_model=FindingRead)
async def get_finding(finding_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Finding, finding_id)
    if not obj: raise HTTPException(404, "Finding not found")
    return obj

@router.patch("/{finding_id}", response_model=FindingRead)
async def update_finding(finding_id: str, body: FindingUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Finding, finding_id)
    if not obj: raise HTTPException(404, "Finding not found")
    updated = await update_obj(session, obj, body.model_dump(exclude_unset=True))
    # Increment version on update
    updated.version = (updated.version or 1) + 1
    await session.flush()
    return updated

@router.delete("/{finding_id}", status_code=204)
async def delete_finding(finding_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Finding, finding_id)
    if not obj: raise HTTPException(404, "Finding not found")
    await delete_obj(session, obj)
