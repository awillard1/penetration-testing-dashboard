"""WatchPath model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class WatchPath(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "watch_paths"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(1024), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="custom", nullable=False)
    is_recursive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    engagement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="SET NULL"), nullable=True
    )
    file_patterns: Mapped[str | None] = mapped_column(Text, nullable=True)
    ignore_patterns: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_event: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)

    engagement: Mapped["Engagement | None"] = relationship("Engagement", back_populates="watch_paths")
