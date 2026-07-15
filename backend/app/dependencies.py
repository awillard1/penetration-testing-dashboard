"""FastAPI dependencies."""
from __future__ import annotations

from typing import AsyncIterator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_session


async def db_session(session: AsyncSession = Depends(get_session)) -> AsyncIterator[AsyncSession]:
    yield session
