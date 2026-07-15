"""Global search API."""
from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.schemas.schemas import SearchResult

router = APIRouter()

@router.get("", response_model=List[SearchResult])
async def global_search(
    q: str = Query(..., min_length=2),
    limit: int = Query(30, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    results: list[SearchResult] = []
    if not q.strip():
        return results

    from backend.app.models.engagement import Engagement
    from backend.app.models.finding import Finding
    from backend.app.models.target import Target
    from backend.app.models.note import Note
    from backend.app.models.link import Link
    from backend.app.models.command import Command

    pattern = f"%{q}%"

    engagements = (await session.execute(
        select(Engagement).where(Engagement.name.ilike(pattern)).limit(10)
    )).scalars().all()
    for e in engagements:
        results.append(SearchResult(entity_type="engagement", id=e.id, title=e.name, url=f"/engagements/{e.id}"))

    findings = (await session.execute(
        select(Finding).where(or_(Finding.title.ilike(pattern), Finding.description.ilike(pattern))).limit(10)
    )).scalars().all()
    for f in findings:
        results.append(SearchResult(entity_type="finding", id=f.id, title=f.title, subtitle=f.severity, engagement_id=f.engagement_id, url=f"/findings/{f.id}"))

    targets = (await session.execute(
        select(Target).where(or_(Target.hostname.ilike(pattern), Target.ip_address.ilike(pattern))).limit(10)
    )).scalars().all()
    for t in targets:
        results.append(SearchResult(entity_type="target", id=t.id, title=t.hostname or t.ip_address or t.url or t.id, engagement_id=t.engagement_id, url=f"/targets/{t.id}"))

    notes = (await session.execute(
        select(Note).where(or_(Note.title.ilike(pattern), Note.content.ilike(pattern))).limit(5)
    )).scalars().all()
    for n in notes:
        results.append(SearchResult(entity_type="note", id=n.id, title=n.title, engagement_id=n.engagement_id, url=f"/notes/{n.id}"))

    links = (await session.execute(
        select(Link).where(or_(Link.name.ilike(pattern), Link.url.ilike(pattern))).limit(5)
    )).scalars().all()
    for l in links:
        results.append(SearchResult(entity_type="link", id=l.id, title=l.name, subtitle=l.url, url=f"/links/{l.id}"))

    commands = (await session.execute(
        select(Command).where(or_(Command.name.ilike(pattern), Command.command_text.ilike(pattern))).limit(5)
    )).scalars().all()
    for c in commands:
        results.append(SearchResult(entity_type="command", id=c.id, title=c.name, url=f"/commands/{c.id}"))

    return results[:limit]
