"""Authentication helpers and dependencies."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.config import settings
from backend.app.database import get_session
from backend.app.models.refresh_token import RefreshToken
from backend.app.models.user import User
from backend.app.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)

bearer_scheme = HTTPBearer(auto_error=False)
PUBLIC_API_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/health",
}
STAFF_ROLES = {"admin", "penetration_tester"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def extract_access_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token:
            return token
    return request.cookies.get(settings.access_cookie_name)


def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        settings.access_cookie_name,
        access_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        settings.refresh_cookie_name,
        refresh_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookies(response) -> None:
    response.delete_cookie(settings.access_cookie_name, path="/")
    response.delete_cookie(settings.refresh_cookie_name, path="/")


async def issue_token_pair(session: AsyncSession, user: User) -> tuple[str, str]:
    access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        role=user.role,
        expires_in_minutes=settings.access_token_expire_minutes,
    )
    refresh_token = generate_token(48)
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=_utcnow() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    user.last_login_at = _utcnow()
    await session.flush()
    return access_token, refresh_token


async def revoke_refresh_token(session: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    token_hash = hash_token(refresh_token)
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    token_row = result.scalars().first()
    if token_row and token_row.revoked_at is None:
        token_row.revoked_at = _utcnow()
        await session.flush()


async def authenticate_local_user(
    session: AsyncSession,
    username: str,
    password: str,
) -> User | None:
    result = await session.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def consume_refresh_token(session: AsyncSession, refresh_token: str) -> User:
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
    )
    token_row = result.scalars().first()
    if (
        not token_row
        or token_row.revoked_at is not None
        or token_row.expires_at <= _utcnow()
    ):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    token_row.revoked_at = _utcnow()
    user = await session.get(User, token_row.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User is not active")
    await session.flush()
    return user


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or not request.url.path.startswith("/api/v1"):
            return await call_next(request)
        if request.url.path in PUBLIC_API_PATHS:
            return await call_next(request)

        token = extract_access_token(request)
        if not token:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing bearer token"},
            )

        try:
            request.state.token_payload = decode_access_token(token)
        except TokenError:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid bearer token"},
            )
        return await call_next(request)


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> User:
    payload = getattr(request.state, "token_payload", None)
    token = credentials.credentials if payload is None and credentials else None
    if payload is None:
        if token is None:
            token = extract_access_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required")
        try:
            payload = decode_access_token(token)
        except TokenError as exc:
            raise HTTPException(status_code=401, detail="Invalid bearer token") from exc

    user = await session.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User is not active")
    request.state.current_user = user
    return user


async def require_authenticated_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user


def require_roles(*roles: str):
    allowed_roles = set(roles)

    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return dependency


require_staff_user = require_roles(*STAFF_ROLES)
require_admin_user = require_roles("admin")


def ensure_staff_user(current_user: User) -> None:
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def serialize_user(user: User) -> dict[str, str | bool | None]:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "is_active": user.is_active,
        "client_id": user.client_id,
        "auth_provider": user.auth_provider,
    }


async def ensure_bootstrap_admin() -> None:
    if settings.auth_mode != "local":
        return
    from backend.app.database import async_session_factory

    async with async_session_factory() as session:
        result = await session.execute(select(User).limit(1))
        if result.scalars().first():
            return
        session.add(
            User(
                username=settings.bootstrap_admin_username,
                display_name="Bootstrap Admin",
                hashed_password=hash_password(settings.bootstrap_admin_password),
                role="admin",
                auth_provider="local",
                is_active=True,
            )
        )
        await session.commit()
