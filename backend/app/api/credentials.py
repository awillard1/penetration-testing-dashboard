"""Credentials API."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_session
from backend.app.models.credential import Credential, HashRecord
from backend.app.schemas.schemas import CredentialCreate, CredentialRead, CredentialUpdate, HashRecordCreate, HashRecordRead, HashRecordUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj
from backend.app.security import encrypt_secret, decrypt_secret

router = APIRouter()

@router.get("", response_model=list[CredentialRead])
async def list_credentials(
    engagement_id: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(Credential.engagement_id == engagement_id)
    if target_id: filters.append(Credential.target_id == target_id)
    rows, _ = await list_all(session, Credential, filters, skip, limit, Credential.created_at.desc())
    return rows

@router.post("", response_model=CredentialRead, status_code=201)
async def create_credential(body: CredentialCreate, session: AsyncSession = Depends(get_session)):
    data = body.model_dump(exclude={"plaintext_secret"})
    if body.plaintext_secret:
        data["encrypted_secret"] = encrypt_secret(body.plaintext_secret)
    return await create_obj(session, Credential, data)

@router.get("/{cred_id}", response_model=CredentialRead)
async def get_credential(cred_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Credential, cred_id)
    if not obj: raise HTTPException(404, "Credential not found")
    return obj

@router.patch("/{cred_id}", response_model=CredentialRead)
async def update_credential(cred_id: str, body: CredentialUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Credential, cred_id)
    if not obj: raise HTTPException(404, "Credential not found")
    data = body.model_dump(exclude_unset=True, exclude={"plaintext_secret"})
    if body.plaintext_secret:
        data["encrypted_secret"] = encrypt_secret(body.plaintext_secret)
    return await update_obj(session, obj, data)

@router.delete("/{cred_id}", status_code=204)
async def delete_credential(cred_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Credential, cred_id)
    if not obj: raise HTTPException(404, "Credential not found")
    await delete_obj(session, obj)

@router.post("/{cred_id}/reveal")
async def reveal_secret(cred_id: str, session: AsyncSession = Depends(get_session)):
    """Reveal the decrypted secret value for a credential."""
    obj = await get_by_id(session, Credential, cred_id)
    if not obj: raise HTTPException(404, "Credential not found")
    if not obj.encrypted_secret:
        return {"secret": None}
    try:
        return {"secret": decrypt_secret(obj.encrypted_secret)}
    except Exception:
        raise HTTPException(500, "Failed to decrypt credential")

# Hash records
@router.get("/hashes", response_model=list[HashRecordRead])
async def list_hashes(
    engagement_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id: filters.append(HashRecord.engagement_id == engagement_id)
    rows, _ = await list_all(session, HashRecord, filters, skip, limit)
    return rows

@router.post("/hashes", response_model=HashRecordRead, status_code=201)
async def create_hash(body: HashRecordCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, HashRecord, body.model_dump())

@router.patch("/hashes/{hash_id}", response_model=HashRecordRead)
async def update_hash(hash_id: str, body: HashRecordUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, HashRecord, hash_id)
    if not obj: raise HTTPException(404, "Hash record not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))

@router.delete("/hashes/{hash_id}", status_code=204)
async def delete_hash(hash_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, HashRecord, hash_id)
    if not obj: raise HTTPException(404, "Hash record not found")
    await delete_obj(session, obj)
