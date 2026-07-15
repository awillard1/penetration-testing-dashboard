"""Target model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class Target(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "targets"

    engagement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("engagements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protocol: Mapped[str | None] = mapped_column(String(16), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    operating_system: Mapped[str | None] = mapped_column(String(128), nullable=True)
    technology: Mapped[str | None] = mapped_column(Text, nullable=True)
    environment: Mapped[str | None] = mapped_column(String(64), nullable=True)
    asset_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    auth_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    creds_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)

    engagement: Mapped["Engagement"] = relationship("Engagement", back_populates="targets")
    finding_targets: Mapped[list] = relationship(
        "FindingTarget", back_populates="target", cascade="all, delete-orphan"
    )
    credentials: Mapped[list] = relationship("Credential", back_populates="target")
    scan_results: Mapped[list] = relationship("ScanResult", back_populates="target")
