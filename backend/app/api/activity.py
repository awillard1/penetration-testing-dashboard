"""Activity API."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_session
from backend.app.models.activity import ActivityEvent
from backend.app.schemas.schemas import ActivityEventRead
from backend.app.utils.crud import list_all

router = APIRouter()


@router.get("", response_model=list[ActivityEventRead])
async def list_activity(
    engagement_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id:
        filters.append(ActivityEvent.engagement_id == engagement_id)
    if event_type:
        filters.append(ActivityEvent.event_type == event_type)

    rows, _ = await list_all(
        session,
        ActivityEvent,
        filters,
        skip,
        limit,
        ActivityEvent.created_at.desc(),
    )
    return rows
