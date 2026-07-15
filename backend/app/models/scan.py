"""ScanImport and ScanResult models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class ScanImport(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scan_imports"

    engagement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("engagements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    scan_type: Mapped[str] = mapped_column(String(64), default="unknown", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    imported_targets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_findings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    engagement: Mapped["Engagement"] = relationship("Engagement", back_populates="scan_imports")
    results: Mapped[list[ScanResult]] = relationship(
        "ScanResult", back_populates="scan_import", cascade="all, delete-orphan"
    )


class ScanResult(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scan_results"

    scan_import_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scan_imports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True
    )
    finding_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )
    result_type: Mapped[str] = mapped_column(String(64), default="other", nullable=False)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(32), nullable=True)
    data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    scan_import: Mapped[ScanImport] = relationship("ScanImport", back_populates="results")
    target: Mapped["Target | None"] = relationship("Target", back_populates="scan_results")
