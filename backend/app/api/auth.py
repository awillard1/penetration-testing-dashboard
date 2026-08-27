"""Authentication API."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.auth import (
    authenticate_local_user,
    clear_auth_cookies,
    consume_refresh_token,
    issue_token_pair,
    require_admin_user,
    require_authenticated_user,
    revoke_refresh_token,
    serialize_user,
    set_auth_cookies,
)
from backend.app.config import settings
from backend.app.database import get_session
from backend.app.models.user import User
from backend.app.schemas.schemas import (
    AuthLoginRequest,
    AuthRefreshRequest,
    AuthTokenResponse,
    UserCreate,
    UserRead,
)
from backend.app.security import hash_password

router = APIRouter()


async def _parse_login_request(request: Request) -> AuthLoginRequest:
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        submitted_password = str(form.get("password") or "")
        return AuthLoginRequest.model_validate(
            {
                "username": str(form.get("username") or "").strip(),
                "password": submitted_password,
            }
        )
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid login payload") from exc
    try:
        return AuthLoginRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    if settings.auth_mode != "local":
        raise HTTPException(status_code=501, detail=f"Unsupported auth mode: {settings.auth_mode}")
    body = await _parse_login_request(request)
    user = await authenticate_local_user(session, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    access_token, refresh_token = await issue_token_pair(session, user)
    set_auth_cookies(response, access_token, refresh_token)
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(serialize_user(user)),
    )


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh_token(
    response: Response,
    request: Request,
    body: AuthRefreshRequest | None = Body(default=None),
    session: AsyncSession = Depends(get_session),
):
    refresh_token_value = body.refresh_token if body else None
    if not refresh_token_value:
        refresh_token_value = request.cookies.get(settings.refresh_cookie_name)
    if not refresh_token_value:
        raise HTTPException(status_code=401, detail="Refresh token required")
    user = await consume_refresh_token(session, refresh_token_value)
    access_token, new_refresh_token = await issue_token_pair(session, user)
    set_auth_cookies(response, access_token, new_refresh_token)
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(serialize_user(user)),
    )


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    request: Request,
    body: AuthRefreshRequest | None = Body(default=None),
    session: AsyncSession = Depends(get_session),
):
    refresh_token_value = body.refresh_token if body else None
    if not refresh_token_value:
        refresh_token_value = request.cookies.get(settings.refresh_cookie_name)
    await revoke_refresh_token(session, refresh_token_value)
    clear_auth_cookies(response)


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(require_authenticated_user)):
    return UserRead.model_validate(serialize_user(current_user))


@router.get("/users", response_model=list[UserRead], dependencies=[Depends(require_admin_user)])
async def list_users(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(User).order_by(User.username))).scalars().all()
    return [UserRead.model_validate(serialize_user(user)) for user in rows]


@router.post("/users", response_model=UserRead, status_code=201, dependencies=[Depends(require_admin_user)])
async def create_user(body: UserCreate, session: AsyncSession = Depends(get_session)):
    existing = (
        await session.execute(select(User).where(User.username == body.username))
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=body.username,
        email=body.email,
        display_name=body.display_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=body.is_active,
        client_id=body.client_id,
        auth_provider="local",
    )
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return UserRead.model_validate(serialize_user(user))
