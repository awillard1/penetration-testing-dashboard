"""Runner node models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class RunnerNode(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "runner_nodes"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(64), nullable=True)
    architecture: Mapped[str | None] = mapped_column(String(64), nullable=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    capabilities_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    tools_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class RunnerJobEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "runner_job_events"

    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("command_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    runner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("runner_nodes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
