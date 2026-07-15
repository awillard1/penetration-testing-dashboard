"""ApplicationSetting model."""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class ApplicationSetting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "application_settings"

    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    setting_type: Mapped[str] = mapped_column(String(32), default="string", nullable=False)
