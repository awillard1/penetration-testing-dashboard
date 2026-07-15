"""Generic CRUD helpers."""
from __future__ import annotations

from typing import Any, Optional, Type, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


async def get_by_id(
    session: AsyncSession, model: Type[ModelT], obj_id: str
) -> Optional[ModelT]:
    result = await session.execute(select(model).where(model.id == obj_id))
    return result.scalars().first()


async def list_all(
    session: AsyncSession,
    model: Type[ModelT],
    filters: Optional[list] = None,
    offset: int = 0,
    limit: int = 50,
    order_by=None,
) -> tuple[list[ModelT], int]:
    q = select(model)
    count_q = select(func.count()).select_from(model)
    if filters:
        for f in filters:
            q = q.where(f)
            count_q = count_q.where(f)
    if order_by is not None:
        q = q.order_by(order_by)
    q = q.offset(offset).limit(limit)
    rows = (await session.execute(q)).scalars().all()
    total = (await session.execute(count_q)).scalar() or 0
    return list(rows), int(total)


async def create_obj(session: AsyncSession, model: Type[ModelT], data: dict[str, Any]) -> ModelT:
    obj = model(**data)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def update_obj(
    session: AsyncSession, obj: ModelT, data: dict[str, Any]
) -> ModelT:
    for k, v in data.items():
        if hasattr(obj, k):
            setattr(obj, k, v)
    await session.flush()
    await session.refresh(obj)
    return obj


async def delete_obj(session: AsyncSession, obj: ModelT) -> None:
    await session.delete(obj)
    await session.flush()
