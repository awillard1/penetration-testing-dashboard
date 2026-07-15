"""Link and LinkCollection models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class LinkCollection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "link_collections"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    engagement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="SET NULL"), nullable=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    links: Mapped[list[Link]] = relationship(
        "Link", back_populates="collection", cascade="all, delete-orphan"
    )


class Link(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "links"

    name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="other", nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    collection_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("link_collections.id", ondelete="SET NULL"), nullable=True
    )
    engagement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True
    )
    finding_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )
    auth_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_opened: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    open_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    collection: Mapped[LinkCollection | None] = relationship(
        "LinkCollection", back_populates="links"
    )
    engagement: Mapped["Engagement | None"] = relationship("Engagement", back_populates="links")
