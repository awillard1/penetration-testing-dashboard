"""Database initialization and session management."""
from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.app.config import settings
from backend.app.models.base import Base

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


async def init_db() -> None:
    """Create tables for all models."""
    import backend.app.models  # noqa: F401 – register all models

    async with engine.begin() as conn:
        # Enable WAL mode and foreign keys for SQLite
        if "sqlite" in _db_url:
            await conn.execute(__import__("sqlalchemy").text("PRAGMA journal_mode=WAL"))
            await conn.execute(__import__("sqlalchemy").text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(Base.metadata.create_all)
