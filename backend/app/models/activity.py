"""ActivityEvent model."""
from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class ActivityEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "activity_events"

    engagement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=True, index=True
    )
    actor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    object_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    object_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    engagement: Mapped["Engagement | None"] = relationship("Engagement", back_populates="activity_events")
