"""Application configuration."""
from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PENTEST_DASHBOARD_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8765
    debug: bool = False
    log_level: str = "INFO"

    database_url: str = "sqlite+aiosqlite:///./data/database/dashboard.db"
    data_dir: Path = Path("./data")
    attachment_dir: Path = Path("./data/attachments")
    screenshot_dir: Path = Path("./data/screenshots")
    import_dir: Path = Path("./data/imports")
    export_dir: Path = Path("./data/exports")
    report_dir: Path = Path("./data/reports")
    backup_dir: Path = Path("./data/backups")
    log_dir: Path = Path("./data/logs")

    secret_key: str = "change-this-in-production-use-a-random-32-char-string"
    auth_mode: str = "local"

    max_upload_size: int = 100 * 1024 * 1024  # 100 MB
    allowed_origins: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    watcher_enabled: bool = True
    backup_retention: int = 30
    open_browser: bool = True
    operator_command_runner_enabled: bool = True
    operator_burp_ingest_enabled: bool = True

    def ensure_dirs(self) -> None:
        for d in [
            self.data_dir,
            self.attachment_dir,
            self.screenshot_dir,
            self.import_dir,
            self.export_dir,
            self.report_dir,
            self.backup_dir,
            self.log_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
