"""Backup worker."""
from __future__ import annotations
import hashlib, logging, shutil, zipfile
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.config import settings
from backend.app.models.backup import Backup
from backend.app.utils.crud import create_obj

logger = logging.getLogger(__name__)


async def run_backup(session: AsyncSession) -> Backup:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.zip"
    out_path = settings.backup_dir / filename
    out_path.parent.mkdir(parents=True, exist_ok=True)

    db_path = _resolve_db_path()
    with zipfile.ZipFile(str(out_path), "w", zipfile.ZIP_DEFLATED) as zf:
        if db_path and db_path.exists():
            zf.write(str(db_path), arcname="dashboard.db")

    file_size = out_path.stat().st_size
    sha = hashlib.sha256(out_path.read_bytes()).hexdigest()

    obj = await create_obj(session, Backup, {
        "filename": filename,
        "file_path": str(out_path),
        "file_size": file_size,
        "sha256": sha,
        "backup_type": "scheduled",
        "is_verified": True,
    })
    logger.info("Backup created: %s (%d bytes)", filename, file_size)

    # Prune old backups
    await _prune_backups()
    return obj


def _resolve_db_path() -> Path | None:
    url = settings.database_url
    for prefix in ("sqlite+aiosqlite:///", "sqlite:///"):
        if url.startswith(prefix):
            raw = url[len(prefix):]
            p = Path(raw)
            return p if p.is_absolute() else Path.cwd() / p
    return None


async def _prune_backups() -> None:
    retention = settings.backup_retention
    backups = sorted(settings.backup_dir.glob("backup_*.zip"), key=lambda p: p.stat().st_mtime)
    while len(backups) > retention:
        oldest = backups.pop(0)
        oldest.unlink(missing_ok=True)
        logger.info("Pruned old backup: %s", oldest.name)
