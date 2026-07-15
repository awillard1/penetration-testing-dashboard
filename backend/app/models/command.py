"""Command model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class Command(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "commands"

    name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(64), default="other", nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    command_text: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    operating_system: Mapped[str] = mapped_column(String(32), default="any", nullable=False)
    tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_used: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
