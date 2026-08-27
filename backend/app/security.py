"""Security utilities: password hashing, secret encryption, and auth token helpers."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from cryptography.fernet import Fernet

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except Exception:
        return False


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the application secret key."""
    from backend.app.config import settings

    raw = settings.secret_key.encode()
    # Pad/trim to 32 bytes then base64url-encode for Fernet
    key_bytes = (raw * 4)[:32]
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_secret(value: str) -> str:
    """Encrypt a plaintext secret and return a base64 string."""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_secret(token: str) -> str:
    """Decrypt a previously encrypted secret."""
    return _get_fernet().decrypt(token.encode()).decode()


def generate_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


class TokenError(ValueError):
    """Raised when a JWT cannot be validated."""


def _get_signing_key() -> str:
    from backend.app.config import settings

    return settings.secret_key


def create_access_token(
    *,
    user_id: str,
    username: str,
    role: str,
    expires_in_minutes: int,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "type": "access",
        "jti": secrets.token_urlsafe(12),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_in_minutes)).timestamp()),
    }
    return jwt.encode(payload, _get_signing_key(), algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, _get_signing_key(), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if payload.get("type") != "access" or not payload.get("sub"):
        raise TokenError("Invalid access token")
    return payload


def hash_token(token: str) -> str:
    return hmac.new(_get_signing_key().encode(), token.encode(), hashlib.sha256).hexdigest()
