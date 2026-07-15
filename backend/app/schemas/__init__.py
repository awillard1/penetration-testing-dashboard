"""Shared Pydantic schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    data: Optional[T] = None
    meta: dict[str, Any] = {}
    errors: list[dict[str, Any]] = []


class PaginatedMeta(BaseModel):
    total: int
    page: int
    per_page: int
    pages: int


class TimestampSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
