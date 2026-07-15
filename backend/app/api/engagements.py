"""Engagements API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.engagement import Engagement
from backend.app.schemas.schemas import EngagementCreate, EngagementRead, EngagementUpdate, DashboardSummary
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from sqlalchemy import select, func

router = APIRouter()

@router.get("", response_model=list[EngagementRead])
async def list_engagements(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    is_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    filters = [Engagement.is_archived == is_archived]
    if status:
        filters.append(Engagement.status == status)
    if client_id:
        filters.append(Engagement.client_id == client_id)
    if q:
        filters.append(Engagement.name.ilike(f"%{q}%"))
    rows, _ = await list_all(session, Engagement, filters, skip, limit, Engagement.created_at.desc())
    return rows

@router.post("", response_model=EngagementRead, status_code=201)
async def create_engagement(body: EngagementCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Engagement, body.model_dump())

@router.get("/{eng_id}", response_model=EngagementRead)
async def get_engagement(eng_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Engagement, eng_id)
    if not obj:
        raise HTTPException(404, "Engagement not found")
    return obj

@router.patch("/{eng_id}", response_model=EngagementRead)
async def update_engagement(eng_id: str, body: EngagementUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Engagement, eng_id)
    if not obj:
        raise HTTPException(404, "Engagement not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{eng_id}", status_code=204)
async def delete_engagement(eng_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Engagement, eng_id)
    if not obj:
        raise HTTPException(404, "Engagement not found")
    await delete_obj(session, obj)

@router.get("/{eng_id}/summary", response_model=DashboardSummary)
async def engagement_summary(eng_id: str, session: AsyncSession = Depends(get_session)):
    from backend.app.models.finding import Finding
    from backend.app.models.target import Target
    from backend.app.models.evidence import Evidence
    from backend.app.models.credential import Credential
    from backend.app.models.scan import ScanImport
    from backend.app.models.task import Task
    from backend.app.models.activity import ActivityEvent
    from backend.app.schemas.schemas import ActivityEventRead

    eng = await get_by_id(session, Engagement, eng_id)
    if not eng:
        raise HTTPException(404, "Engagement not found")

    async def count(model, *filters):
        q = select(func.count()).select_from(model).where(*filters)
        return (await session.execute(q)).scalar() or 0

    targets = await count(Target, Target.engagement_id == eng_id)
    findings = await count(Finding, Finding.engagement_id == eng_id)
    evidence = await count(Evidence, Evidence.engagement_id == eng_id)
    creds = await count(Credential, Credential.engagement_id == eng_id)
    scans = await count(ScanImport, ScanImport.engagement_id == eng_id)
    open_tasks = await count(Task, Task.engagement_id == eng_id, Task.status.notin_(["complete", "cancelled"]))

    # severity breakdown
    sev_rows = (await session.execute(
        select(Finding.severity, func.count()).where(Finding.engagement_id == eng_id).group_by(Finding.severity)
    )).all()
    # status breakdown
    stat_rows = (await session.execute(
        select(Finding.status, func.count()).where(Finding.engagement_id == eng_id).group_by(Finding.status)
    )).all()

    recent_q = select(ActivityEvent).where(ActivityEvent.engagement_id == eng_id).order_by(ActivityEvent.created_at.desc()).limit(10)
    recent = (await session.execute(recent_q)).scalars().all()

    from backend.app.schemas.schemas import EngagementRead
    return DashboardSummary(
        active_engagement=EngagementRead.model_validate(eng),
        total_targets=targets,
        total_findings=findings,
        findings_by_severity={s: c for s, c in sev_rows},
        findings_by_status={s: c for s, c in stat_rows},
        open_tasks=open_tasks,
        evidence_count=evidence,
        credential_count=creds,
        scan_count=scans,
        recent_activity=[ActivityEventRead.model_validate(r) for r in recent],
    )
