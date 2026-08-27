"""Database initialization and session management."""
from __future__ import annotations

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


async def _run_async_migrations() -> None:
    """Run Alembic migrations asynchronously without using the Alembic CLI."""
    import backend.app.models  # noqa: F401 - register all models
    from backend.app.models.base import Base
    from sqlalchemy.ext.asyncio import async_engine_from_config

    url = _db_url
    if url.startswith("sqlite:///") and not url.startswith("sqlite+aiosqlite:///"):
        url = url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

    connectable = async_engine_from_config(
        {"sqlalchemy.url": url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        def do_run_migrations(conn):
            from alembic import context
            from alembic.config import Config

            alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"
            alembic_cfg = Config(str(alembic_ini))
            alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)

            context.configure(connection=conn, target_metadata=Base.metadata)
            with context.begin_transaction():
                context.run_migrations()

        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


async def init_db() -> None:
    """Initialize database pragmas and apply Alembic migrations."""
    async with engine.begin() as conn:
        # Enable WAL mode and foreign keys for SQLite
        if "sqlite" in _db_url:
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA foreign_keys=ON"))

    await _run_async_migrations()
