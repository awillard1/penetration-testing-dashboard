"""Logging configuration."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from backend.app.config import settings


def configure_logging() -> None:
    log_file = settings.log_dir / "dashboard.log"
    handlers: list[logging.Handler] = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ]
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )
    # Suppress noisy libraries
    logging.getLogger("watchdog").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
