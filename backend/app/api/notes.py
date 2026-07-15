"""Notes API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.note import Note
from backend.app.schemas.schemas import NoteCreate, NoteRead, NoteUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()

@router.get("", response_model=list[NoteRead])
async def list_notes(
    engagement_id: Optional[str] = Query(None),
    note_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Note.engagement_id == engagement_id)
    if note_type: filters.append(Note.note_type == note_type)
    if q: filters.append(Note.title.ilike(f"%{q}%"))
    rows, _ = await list_all(session, Note, filters, skip, limit, Note.updated_at.desc())
    return rows

@router.post("", response_model=NoteRead, status_code=201)
async def create_note(body: NoteCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Note, body.model_dump())

@router.get("/{note_id}", response_model=NoteRead)
async def get_note(note_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Note, note_id)
    if not obj: raise HTTPException(404, "Note not found")
    return obj

@router.patch("/{note_id}", response_model=NoteRead)
async def update_note(note_id: str, body: NoteUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Note, note_id)
    if not obj: raise HTTPException(404, "Note not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Note, note_id)
    if not obj: raise HTTPException(404, "Note not found")
    await delete_obj(session, obj)
