"""Credential and HashRecord models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class Credential(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "credentials"

    engagement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("engagements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True
    )
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    secret_type: Mapped[str] = mapped_column(String(64), default="password", nullable=False)
    # Encrypted secret value – never logged
    encrypted_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    privilege_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    validation_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_compromised: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_reused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)

    target: Mapped["Target | None"] = relationship("Target", back_populates="credentials")


class HashRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hash_records"

    engagement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("engagements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True
    )
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hash_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    hash_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_cracked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    credential_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("credentials.id", ondelete="SET NULL"), nullable=True
    )
    crack_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    session_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
