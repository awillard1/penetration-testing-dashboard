"""Security utilities: password hashing, secret encryption, token generation."""
from __future__ import annotations

import base64
import os
import secrets

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
