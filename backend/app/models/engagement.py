"""Engagement and EngagementMember models."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class Engagement(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "engagements"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    identifier: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    client_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    engagement_type: Mapped[str] = mapped_column(String(64), default="other", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    testing_window: Mapped[str | None] = mapped_column(String(255), nullable=True)
    time_zone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    primary_tester: Mapped[str | None] = mapped_column(String(128), nullable=True)
    scope_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    out_of_scope_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rules_of_engagement: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contacts: Mapped[str | None] = mapped_column(Text, nullable=True)
    authorization_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    testing_constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_methods: Mapped[str | None] = mapped_column(Text, nullable=True)
    prohibited_methods: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_handling: Mapped[str | None] = mapped_column(Text, nullable=True)
    reporting_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    engagement_folder: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    client: Mapped["Client | None"] = relationship("Client", back_populates="engagements")
    members: Mapped[list[EngagementMember]] = relationship(
        "EngagementMember", back_populates="engagement", cascade="all, delete-orphan"
    )
    scope_items: Mapped[list] = relationship(
        "ScopeItem", back_populates="engagement", cascade="all, delete-orphan"
    )
    targets: Mapped[list] = relationship(
        "Target", back_populates="engagement", cascade="all, delete-orphan"
    )
    findings: Mapped[list] = relationship(
        "Finding", back_populates="engagement", cascade="all, delete-orphan"
    )
    tasks: Mapped[list] = relationship(
        "Task", back_populates="engagement", cascade="all, delete-orphan"
    )
    notes: Mapped[list] = relationship(
        "Note", back_populates="engagement", cascade="all, delete-orphan"
    )
    links: Mapped[list] = relationship("Link", back_populates="engagement")
    time_entries: Mapped[list] = relationship(
        "TimeEntry", back_populates="engagement", cascade="all, delete-orphan"
    )
    scan_imports: Mapped[list] = relationship(
        "ScanImport", back_populates="engagement", cascade="all, delete-orphan"
    )
    activity_events: Mapped[list] = relationship(
        "ActivityEvent", back_populates="engagement", cascade="all, delete-orphan"
    )
    reports: Mapped[list] = relationship(
        "Report", back_populates="engagement", cascade="all, delete-orphan"
    )
    watch_paths: Mapped[list] = relationship(
        "WatchPath", back_populates="engagement", cascade="all, delete-orphan"
    )


class EngagementMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "engagement_members"

    engagement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("engagements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    role: Mapped[str] = mapped_column(String(64), default="tester", nullable=False)

    engagement: Mapped[Engagement] = relationship("Engagement", back_populates="members")
