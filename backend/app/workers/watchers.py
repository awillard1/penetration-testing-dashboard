"""Filesystem watcher supporting Windows, WSL UNC paths, and asyncio."""

from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_event_loop: asyncio.AbstractEventLoop | None = None
_stop_event = threading.Event()
_watcher_threads: list[threading.Thread] = []


@dataclass(frozen=True)
class FileState:
    exists: bool
    size: int | None = None
    mtime_ns: int | None = None
    inode: int | None = None


def _get_file_state(path: Path) -> FileState:
    try:
        stat_result = path.stat()

        return FileState(
            exists=True,
            size=stat_result.st_size,
            mtime_ns=stat_result.st_mtime_ns,
            inode=getattr(stat_result, "st_ino", None),
        )
    except FileNotFoundError:
        return FileState(exists=False)
    except OSError:
        logger.exception("Unable to stat watched file: %s", path)
        return FileState(exists=False)


async def _record_file_event(
    event_type: str,
    src_path: str,
    watch_name: str,
    engagement_id: str | None = None,
) -> None:
    try:
        from backend.app.database import async_session_factory
        from backend.app.models.activity import ActivityEvent

        async with async_session_factory() as session:
            obj = ActivityEvent(
                engagement_id=engagement_id,
                event_type=f"file_{event_type}",
                object_type="file",
                description=f"{event_type}: {src_path}",
                source=f"watcher:{watch_name}",
            )

            session.add(obj)
            await session.commit()

    except Exception:
        logger.exception("Failed to record file event for %s", src_path)


def _submit_event(
    event_type: str,
    path: Path,
    watch_name: str,
    engagement_id: str | None,
) -> None:
    logger.info(
        "File event [%s]: %s %s",
        watch_name,
        event_type,
        path,
    )

    loop = _event_loop

    if loop is None:
        logger.error("No asyncio event loop configured")
        return

    if loop.is_closed():
        logger.error("Asyncio event loop is closed")
        return

    if not loop.is_running():
        logger.error("Asyncio event loop is not running")
        return

    future = asyncio.run_coroutine_threadsafe(
        _record_file_event(
            event_type=event_type,
            src_path=str(path),
            watch_name=watch_name,
            engagement_id=engagement_id,
        ),
        loop,
    )

    def handle_completion(completed_future) -> None:
        try:
            completed_future.result()
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception(
                "Failed to persist file event for %s",
                path,
            )

    future.add_done_callback(handle_completion)


def _watch_single_file(
    path: Path,
    watch_name: str,
    engagement_id: str | None,
    interval: float,
) -> None:
    previous = _get_file_state(path)

    logger.info(
        "Starting direct file poller: path=%s initial_state=%s",
        path,
        previous,
    )

    while not _stop_event.wait(interval):
        current = _get_file_state(path)

        if current == previous:
            continue

        if not previous.exists and current.exists:
            event_type = "created"

        elif previous.exists and not current.exists:
            event_type = "deleted"

        elif (
            previous.inode is not None
            and current.inode is not None
            and previous.inode != current.inode
        ):
            event_type = "replaced"

        else:
            event_type = "modified"

        logger.debug(
            "File state changed: path=%s previous=%s current=%s",
            path,
            previous,
            current,
        )

        _submit_event(
            event_type=event_type,
            path=path,
            watch_name=watch_name,
            engagement_id=engagement_id,
        )

        previous = current

    logger.info("File poller stopped: %s", path)


def start_watchers(
    paths: list[dict[str, Any]],
    loop: asyncio.AbstractEventLoop | None = None,
) -> None:
    global _event_loop

    _event_loop = loop
    _stop_event.clear()

    for config in paths:
        path_str = str(config.get("path", "")).strip()

        if not path_str:
            logger.warning("Ignoring watcher with an empty path")
            continue

        path = Path(path_str)
        watch_name = str(config.get("name") or path_str)
        engagement_id = config.get("engagement_id")
        interval = float(config.get("poll_interval", 1.0))

        if path.is_dir():
            logger.warning(
                "Direct polling requires a file path, not a directory: %s",
                path,
            )
            continue

        thread = threading.Thread(
            target=_watch_single_file,
            args=(
                path,
                watch_name,
                engagement_id,
                interval,
            ),
            name=f"file-poller-{len(_watcher_threads) + 1}",
            daemon=True,
        )

        thread.start()
        _watcher_threads.append(thread)


def stop_watchers() -> None:
    global _event_loop

    _stop_event.set()

    for thread in _watcher_threads:
        thread.join(timeout=5)

    _watcher_threads.clear()
    _event_loop = None

    logger.info("All file pollers stopped")


def restart_watchers(
    paths: list[dict[str, Any]],
    loop: asyncio.AbstractEventLoop | None = None,
) -> None:
    stop_watchers()
    start_watchers(paths, loop=loop)
