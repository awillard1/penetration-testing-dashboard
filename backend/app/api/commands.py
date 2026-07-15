"""Commands API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.command import Command
from backend.app.schemas.schemas import CommandCreate, CommandRead, CommandUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.models.base import utcnow

router = APIRouter()

@router.get("", response_model=list[CommandRead])
async def list_commands(
    category: Optional[str] = Query(None),
    tool: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if category: filters.append(Command.category == category)
    if tool: filters.append(Command.tool == tool)
    if is_favorite is not None: filters.append(Command.is_favorite == is_favorite)
    if q: filters.append(Command.name.ilike(f"%{q}%"))
    rows, _ = await list_all(session, Command, filters, skip, limit, Command.name)
    return rows

@router.post("", response_model=CommandRead, status_code=201)
async def create_command(body: CommandCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Command, body.model_dump())

@router.get("/{cmd_id}", response_model=CommandRead)
async def get_command(cmd_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Command, cmd_id)
    if not obj: raise HTTPException(404, "Command not found")
    return obj

@router.patch("/{cmd_id}", response_model=CommandRead)
async def update_command(cmd_id: str, body: CommandUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Command, cmd_id)
    if not obj: raise HTTPException(404, "Command not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.post("/{cmd_id}/use", response_model=CommandRead)
async def record_use(cmd_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Command, cmd_id)
    if not obj: raise HTTPException(404, "Command not found")
    return await update_obj(session, obj, {"last_used": utcnow(), "usage_count": (obj.usage_count or 0) + 1})

@router.delete("/{cmd_id}", status_code=204)
async def delete_command(cmd_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Command, cmd_id)
    if not obj: raise HTTPException(404, "Command not found")
    await delete_obj(session, obj)
