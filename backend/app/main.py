"""PentestDashboard backend application entry point."""
from __future__ import annotations

import logging
import sys
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.router import api_router
from backend.app.config import settings
from backend.app.database import engine, init_db
from backend.app.logging_config import configure_logging
from backend.app.workers.scheduler import start_scheduler, stop_scheduler
from backend.app.workers.watchers import start_watchers, stop_watchers

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info("PentestDashboard starting up")
    await init_db()
    start_scheduler()
    if settings.watcher_enabled:
        from backend.app.database import async_session_factory
        from backend.app.models.watch_path import WatchPath
        from sqlalchemy import select
        async with async_session_factory() as session:
            result = await session.execute(select(WatchPath).where(WatchPath.is_enabled))  # noqa: E712
            paths = [{"name": wp.name, "path": wp.path, "is_recursive": wp.is_recursive} for wp in result.scalars()]
        start_watchers(paths)
    if settings.open_browser:
        url = f"http://{settings.host}:{settings.port}"
        webbrowser.open(url)
    yield
    stop_watchers()
    stop_scheduler()
    await engine.dispose()
    logger.info("PentestDashboard shut down")


app = FastAPI(
    title="PentestDashboard",
    version="0.1.0",
    description="Local-first penetration testing engagement management platform",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# Serve built frontend if available
_frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
    async def spa_fallback(full_path: str) -> HTMLResponse:
        index = _frontend_dist / "index.html"
        return HTMLResponse(index.read_text())


def run_server() -> None:
    uvicorn.run(
        "backend.app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    run_server()
