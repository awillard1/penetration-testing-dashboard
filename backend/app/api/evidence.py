"""Evidence API."""
from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.database import get_session
from backend.app.models.evidence import Evidence
from backend.app.models.finding import FindingEvidence
from backend.app.schemas.schemas import EvidenceCreate, EvidenceRead, EvidenceUpdate
from backend.app.utils.crud import create_obj, delete_obj, get_by_id, list_all, update_obj

router = APIRouter()

TEXT_PREVIEW_MIME_PREFIXES = (
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "application/yaml",
    "application/x-yaml",
)

TEXT_PREVIEW_EXTENSIONS = {
    ".txt",
    ".log",
    ".csv",
    ".json",
    ".jsonl",
    ".xml",
    ".yaml",
    ".yml",
    ".md",
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".html",
    ".http",
    ".req",
    ".res",
}


def _resolve_file_path(obj: Evidence) -> Path:
    if not obj.file_path:
        raise HTTPException(404, "No file available for this evidence item")

    base_dir = settings.attachment_dir.resolve()
    file_path = Path(obj.file_path).resolve()
    if not file_path.is_relative_to(base_dir):
        raise HTTPException(403, "Invalid evidence file path")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(404, "Evidence file not found")
    return file_path


def _is_text_previewable(file_path: Path, mime_type: str | None) -> bool:
    mime = (mime_type or "").lower()
    if mime.startswith(TEXT_PREVIEW_MIME_PREFIXES):
        return True
    return file_path.suffix.lower() in TEXT_PREVIEW_EXTENSIONS


def _pretty_content(content: str, mime_type: str | None) -> str:
    import json
    import xml.dom.minidom

    mime = (mime_type or "").lower()
    if "json" in mime:
        try:
            return json.dumps(json.loads(content), indent=2, ensure_ascii=False)
        except Exception:
            return content
    if "xml" in mime or content.lstrip().startswith("<"):
        try:
            return xml.dom.minidom.parseString(content.encode("utf-8")).toprettyxml(indent="  ")
        except Exception:
            return content
    return content


def _range_stream(file_path: Path, start: int, end: int, chunk_size: int = 1024 * 64):
    with file_path.open("rb") as handle:
        handle.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            read_len = min(chunk_size, remaining)
            data = handle.read(read_len)
            if not data:
                break
            yield data
            remaining -= len(data)


def _parse_range(range_header: str | None, file_size: int) -> tuple[int, int] | None:
    if not range_header or not range_header.startswith("bytes="):
        return None

    try:
        value = range_header.replace("bytes=", "", 1)
        start_str, end_str = value.split("-", 1)
        if start_str == "":
            suffix = int(end_str)
            start = max(file_size - suffix, 0)
            end = file_size - 1
        else:
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1
        if start < 0 or end >= file_size or start > end:
            return None
        return start, end
    except Exception:
        return None


@router.get("", response_model=list[EvidenceRead])
async def list_evidence(
    engagement_id: Optional[str] = Query(None),
    finding_id: Optional[str] = Query(None),
    evidence_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if engagement_id:
        filters.append(Evidence.engagement_id == engagement_id)
    if evidence_type:
        filters.append(Evidence.evidence_type == evidence_type)
    if q:
        filters.append(Evidence.title.ilike(f"%{q}%"))
    if finding_id:
        fe_ids = (
            await session.execute(select(FindingEvidence.evidence_id).where(FindingEvidence.finding_id == finding_id))
        ).scalars().all()
        filters.append(Evidence.id.in_(fe_ids))
    rows, _ = await list_all(session, Evidence, filters, skip, limit, Evidence.created_at.desc())
    return rows


@router.post("", response_model=EvidenceRead, status_code=201)
async def create_evidence(body: EvidenceCreate, session: AsyncSession = Depends(get_session)):
    return await create_obj(session, Evidence, body.model_dump())


@router.post("/upload", response_model=EvidenceRead, status_code=201)
async def upload_evidence(
    engagement_id: str,
    title: str,
    evidence_type: str = "file",
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if file.size and file.size > settings.max_upload_size:
        raise HTTPException(413, "File too large")

    safe_name = Path(file.filename or "upload").name
    content = await file.read()
    sha = hashlib.sha256(content).hexdigest()

    dest_dir = (settings.attachment_dir / engagement_id).resolve()
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{sha[:16]}_{safe_name}"
    dest.write_bytes(content)

    guessed_mime = file.content_type or mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
    data = {
        "engagement_id": engagement_id,
        "title": title,
        "evidence_type": evidence_type,
        "file_path": str(dest),
        "original_filename": safe_name,
        "mime_type": guessed_mime,
        "file_size": len(content),
        "sha256": sha,
    }
    return await create_obj(session, Evidence, data)


@router.get("/{ev_id}", response_model=EvidenceRead)
async def get_evidence(ev_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj:
        raise HTTPException(404, "Evidence not found")
    return obj


@router.get("/{ev_id}/detail")
async def get_evidence_detail(ev_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj:
        raise HTTPException(404, "Evidence not found")

    finding_links = (
        await session.execute(select(FindingEvidence.finding_id).where(FindingEvidence.evidence_id == ev_id))
    ).scalars().all()

    file_exists = False
    preview_kind = "none"
    resolved_file = None
    try:
        resolved_file = _resolve_file_path(obj)
        file_exists = True
        mime = (obj.mime_type or "").lower()
        if mime.startswith("image/") and mime != "image/svg+xml":
            preview_kind = "image"
        elif mime in {"application/pdf"}:
            preview_kind = "pdf"
        elif _is_text_previewable(resolved_file, obj.mime_type):
            preview_kind = "text"
        else:
            preview_kind = "binary"
    except HTTPException:
        file_exists = False

    return {
        "id": obj.id,
        "title": obj.title,
        "description": obj.description,
        "evidence_type": obj.evidence_type,
        "engagement_id": obj.engagement_id,
        "target_id": obj.target_id,
        "original_filename": obj.original_filename,
        "mime_type": obj.mime_type,
        "file_size": obj.file_size,
        "sha256": obj.sha256,
        "captured_by": obj.captured_by,
        "capture_date": obj.capture_date,
        "source_tool": obj.source_tool,
        "command_used": obj.command_used,
        "tags": obj.tags,
        "notes": obj.notes,
        "is_sensitive": obj.is_sensitive,
        "in_report": obj.in_report,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
        "finding_ids": finding_links,
        "file_exists": file_exists,
        "preview_kind": preview_kind,
        "download_url": f"/api/v1/evidence/{obj.id}/file?download=true",
        "inline_url": f"/api/v1/evidence/{obj.id}/file",
        "preview_url": f"/api/v1/evidence/{obj.id}/preview",
        "resolved_name": resolved_file.name if resolved_file else None,
    }


@router.get("/{ev_id}/file")
async def get_evidence_file(
    ev_id: str,
    range_header: str | None = Header(default=None, alias="Range"),
    download: bool = Query(False),
    session: AsyncSession = Depends(get_session),
):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj:
        raise HTTPException(404, "Evidence not found")

    file_path = _resolve_file_path(obj)
    mime = obj.mime_type or "application/octet-stream"
    filename = obj.original_filename or file_path.name

    file_size = file_path.stat().st_size
    range_values = _parse_range(range_header, file_size)
    disposition = "attachment" if download else "inline"

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'{disposition}; filename="{filename}"',
    }

    if range_values is None:
        return FileResponse(path=file_path, media_type=mime, filename=filename, headers=headers)

    start, end = range_values
    content_length = end - start + 1
    headers.update(
        {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(content_length),
        }
    )
    return StreamingResponse(
        _range_stream(file_path, start, end),
        media_type=mime,
        status_code=206,
        headers=headers,
    )


@router.get("/{ev_id}/preview")
async def preview_evidence(ev_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj:
        raise HTTPException(404, "Evidence not found")

    file_path = _resolve_file_path(obj)
    mime = (obj.mime_type or "").lower()

    if mime.startswith("image/") and mime != "image/svg+xml":
        return JSONResponse(
            {
                "preview_kind": "image",
                "inline_url": f"/api/v1/evidence/{obj.id}/file",
                "mime_type": obj.mime_type,
            }
        )

    if mime == "application/pdf":
        return JSONResponse(
            {
                "preview_kind": "pdf",
                "inline_url": f"/api/v1/evidence/{obj.id}/file",
                "mime_type": obj.mime_type,
            }
        )

    if not _is_text_previewable(file_path, obj.mime_type):
        return JSONResponse(
            {
                "preview_kind": "binary",
                "message": "Preview not available for this file type.",
                "download_url": f"/api/v1/evidence/{obj.id}/file?download=true",
            }
        )

    content = file_path.read_text(encoding="utf-8", errors="replace")
    pretty = _pretty_content(content, obj.mime_type)
    return {
        "preview_kind": "text",
        "mime_type": obj.mime_type,
        "raw": content,
        "pretty": pretty,
    }


@router.post("/{ev_id}/findings/{finding_id}", status_code=201)
async def attach_evidence_to_finding(ev_id: str, finding_id: str, session: AsyncSession = Depends(get_session)):
    evidence = await get_by_id(session, Evidence, ev_id)
    if not evidence:
        raise HTTPException(404, "Evidence not found")

    existing = (
        await session.execute(
            select(FindingEvidence).where(
                FindingEvidence.evidence_id == ev_id,
                FindingEvidence.finding_id == finding_id,
            )
        )
    ).scalars().first()
    if existing:
        return {"status": "already_attached"}

    row = FindingEvidence(finding_id=finding_id, evidence_id=ev_id)
    session.add(row)
    await session.flush()
    return {"status": "attached", "id": row.id}


@router.delete("/{ev_id}/findings/{finding_id}", status_code=204)
async def detach_evidence_from_finding(ev_id: str, finding_id: str, session: AsyncSession = Depends(get_session)):
    row = (
        await session.execute(
            select(FindingEvidence).where(
                FindingEvidence.evidence_id == ev_id,
                FindingEvidence.finding_id == finding_id,
            )
        )
    ).scalars().first()
    if not row:
        raise HTTPException(404, "Association not found")
    await session.delete(row)
    await session.flush()


@router.patch("/{ev_id}", response_model=EvidenceRead)
async def update_evidence(ev_id: str, body: EvidenceUpdate, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj:
        raise HTTPException(404, "Evidence not found")
    return await update_obj(session, obj, body.model_dump(exclude_unset=True))


@router.delete("/{ev_id}", status_code=204)
async def delete_evidence(ev_id: str, session: AsyncSession = Depends(get_session)):
    obj = await get_by_id(session, Evidence, ev_id)
    if not obj:
        raise HTTPException(404, "Evidence not found")

    if obj.file_path:
        file_path = Path(obj.file_path)
        if file_path.exists():
            try:
                resolved = _resolve_file_path(obj)
                resolved.unlink(missing_ok=True)
            except HTTPException:
                pass

    await delete_obj(session, obj)
