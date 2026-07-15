"""File system watcher (optional, uses watchdog)."""
from __future__ import annotations
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_observer = None


def start_watchers(paths: list[dict]) -> None:
    global _observer
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        logger.warning("watchdog not installed; file watching disabled")
        return

    class Handler(FileSystemEventHandler):
        def __init__(self, name: str):
            self.name = name

        def on_any_event(self, event):
            if not event.is_directory:
                logger.info("File event [%s]: %s %s", self.name, event.event_type, event.src_path)

    observer = Observer()
    observer.daemon = True  # don't block process exit
    scheduled = 0
    for p in paths:
        path_str = p.get("path", "")
        wp = Path(path_str)
        if wp.exists():
            observer.schedule(Handler(p.get("name", path_str)), str(wp), recursive=p.get("is_recursive", True))
            logger.info("Watching: %s", wp)
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
