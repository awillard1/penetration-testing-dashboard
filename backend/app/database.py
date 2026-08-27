"""Database initialization and session management."""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.app.config import settings

# Ensure aiosqlite is available for SQLite async
_db_url = settings.database_url
if _db_url.startswith("sqlite:///") and not _db_url.startswith("sqlite+aiosqlite:///"):
    _db_url = _db_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False} if "sqlite" in _db_url else {},
    poolclass=StaticPool if "sqlite" in _db_url else None,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _run_migrations_sync() -> None:
    """Run Alembic migrations synchronously."""
    import backend.app.models  # noqa: F401 - register all models
    from alembic.config import Config
    from alembic import command

    alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "head")


async def init_db() -> None:
    """Initialize database pragmas and apply Alembic migrations."""
    async with engine.begin() as conn:
        # Enable WAL mode and foreign keys for SQLite
        if "sqlite" in _db_url:
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA foreign_keys=ON"))

    # Run migrations in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=1) as executor:
        await loop.run_in_executor(executor, _run_migrations_sync)
