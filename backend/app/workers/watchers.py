"""File system watcher (optional, uses watchdog)."""
from __future__ import annotations
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_observer = None
_event_loop: asyncio.AbstractEventLoop | None = None


async def _record_file_event(event_type: str, src_path: str, watch_name: str) -> None:
    """Persist a file-system event as an ActivityEvent in the database."""
    try:
        from backend.app.database import async_session_factory
        from backend.app.models.activity import ActivityEvent
        async with async_session_factory() as session:
            obj = ActivityEvent(
                event_type=f"file_{event_type}",
                object_type="file",
                description=f"{event_type}: {src_path}",
                source=f"watcher:{watch_name}",
            )
            session.add(obj)
            await session.commit()
    except Exception:
        logger.exception("Failed to record file event for %s", src_path)


def start_watchers(paths: list[dict], loop: asyncio.AbstractEventLoop | None = None) -> None:
    global _observer, _event_loop
    _event_loop = loop
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler, FileSystemEvent
    except ImportError:
        logger.warning("watchdog not installed; file watching disabled")
        return

    class Handler(FileSystemEventHandler):
        def __init__(self, name: str, watch_file: str | None = None):
            self.name = name
            self.watch_file = watch_file  # if set, only events for this specific filename

        def on_any_event(self, event: FileSystemEvent):
            if event.is_directory:
                return
            src = event.src_path
            # If watching a specific file, ignore events for other files
            if self.watch_file and Path(src).name != self.watch_file:
                return
            logger.info("File event [%s]: %s %s", self.name, event.event_type, src)
            if _event_loop is not None and _event_loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    _record_file_event(event.event_type, src, self.name),
                    _event_loop,
                )

    observer = Observer()
    observer.daemon = True  # don't block process exit
    scheduled = 0
    for p in paths:
        path_str = p.get("path", "")
        wp = Path(path_str)
        if wp.exists():
            if wp.is_file():
                # Watch the parent directory and filter events to this file only
                observer.schedule(
                    Handler(p.get("name", path_str), watch_file=wp.name),
                    str(wp.parent),
                    recursive=False,
                )
                logger.info("Watching file: %s", wp)
            else:
                observer.schedule(
                    Handler(p.get("name", path_str)),
                    str(wp),
                    recursive=p.get("is_recursive", True),
                )
                logger.info("Watching directory: %s", wp)
            scheduled += 1
        else:
            logger.warning("Watch path does not exist: %s", wp)
    if scheduled:
        observer.start()
        _observer = observer


def stop_watchers() -> None:
    global _observer
    if _observer is not None and _observer.is_alive():
        _observer.stop()
        _observer.join(timeout=5)
        logger.info("File watcher stopped")
    _observer = None


def restart_watchers(paths: list[dict], loop: asyncio.AbstractEventLoop | None = None) -> None:
    """Stop any running watcher and start fresh with the given paths."""
    stop_watchers()
    start_watchers(paths, loop=loop)
