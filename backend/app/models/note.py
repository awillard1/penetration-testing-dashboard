"""Note model."""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class Note(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notes"

    engagement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=True, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True
    )
    finding_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    note_type: Mapped[str] = mapped_column(String(64), default="general", nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)

    engagement: Mapped["Engagement | None"] = relationship("Engagement", back_populates="notes")
