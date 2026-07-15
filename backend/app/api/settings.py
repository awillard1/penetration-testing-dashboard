"""Settings API."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.setting import ApplicationSetting
from backend.app.schemas.schemas import SettingRead
from backend.app.utils.crud import list_all, update_obj, create_obj
from pydantic import BaseModel

router = APIRouter()

class SettingUpdate(BaseModel):
    value: str | None = None

@router.get("", response_model=list[SettingRead])
async def list_settings(session: AsyncSession = Depends(get_session)):
    rows, _ = await list_all(session, ApplicationSetting, [], 0, 500, ApplicationSetting.key)
    return rows

@router.put("/{key}", response_model=SettingRead)
async def upsert_setting(key: str, body: SettingUpdate, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(ApplicationSetting).where(ApplicationSetting.key == key))
    obj = result.scalars().first()
    if obj:
        return await update_obj(session, obj, {"value": body.value})
    return await create_obj(session, ApplicationSetting, {"key": key, "value": body.value})
