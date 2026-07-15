"""Tasks API."""
from __future__ import annotations
from typing import Optional
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.task import Task, TaskChecklistItem
from backend.app.schemas.schemas import TaskCreate, TaskRead, TaskUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.models.base import utcnow

router = APIRouter()

@router.get("", response_model=list[TaskRead])
async def list_tasks(
    engagement_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_user: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Task.engagement_id == engagement_id)
    if status: filters.append(Task.status == status)
    if priority: filters.append(Task.priority == priority)
    if assigned_user: filters.append(Task.assigned_user == assigned_user)
    rows, _ = await list_all(session, Task, filters, skip, limit, Task.created_at.desc())
    return rows

@router.post("", response_model=TaskRead, status_code=201)
async def create_task(body: TaskCreate, session: AsyncSession = Depends(get_session)):
    data = body.model_dump(exclude={"checklist_items"})
    obj = await create_obj(session, Task, data)
    if body.checklist_items:
        for item in body.checklist_items:
            await create_obj(session, TaskChecklistItem, {**item.model_dump(), "task_id": obj.id})
    await session.refresh(obj)
    return obj

@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Task, task_id)
    if not obj: raise HTTPException(404, "Task not found")
    return obj

@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(task_id: str, body: TaskUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Task, task_id)
    if not obj: raise HTTPException(404, "Task not found")
    data = body.model_dump(exclude_unset=True)
    if data.get("status") == "complete" and not obj.completed_at:
        data["completed_at"] = utcnow()
    return await update_obj(session, obj, data)

@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Task, task_id)
    if not obj: raise HTTPException(404, "Task not found")
    await delete_obj(session, obj)
