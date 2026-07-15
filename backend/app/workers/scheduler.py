"""APScheduler setup."""
from __future__ import annotations
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)
_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    from backend.app.config import settings
    _scheduler = AsyncIOScheduler()
    # Daily backup at 02:00
    _scheduler.add_job(_daily_backup, "cron", hour=2, minute=0, id="daily_backup")
    _scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


async def _daily_backup() -> None:
    logger.info("Running scheduled backup")
    try:
        from backend.app.database import async_session_factory
        async with async_session_factory() as session:
            from backend.app.workers.backups import run_backup
            await run_backup(session)
            await session.commit()
    except Exception as e:
        logger.error("Scheduled backup failed: %s", e)
