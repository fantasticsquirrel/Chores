from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import PlatformRole
from app.models.platform import PlatformUser
from app.security.passwords import hash_password
from app.security.totp import generate_totp_secret
from app.security.totp_crypto import encrypt_totp_secret
from app.config import get_settings


def create_platform_user(
    session: Session,
    *,
    email: str,
    password: str,
    role: PlatformRole,
) -> tuple[PlatformUser, str]:
    """Create a separately authenticated platform operator.

    The caller is responsible for delivering the returned TOTP secret through a
    secure channel and committing the transaction. Passwords and TOTP secrets
    must never be accepted on a command line or written to application logs.
    """
    normalized_email = email.strip().lower()
    if "@" not in normalized_email or len(normalized_email) > 320:
        raise ValueError("A valid platform email is required.")
    if len(password) < 16:
        raise ValueError("Platform passwords must be at least 16 characters.")
    existing = session.scalar(
        select(PlatformUser).where(PlatformUser.email == normalized_email)
    )
    if existing is not None:
        raise ValueError("A platform user with this email already exists.")

    secret = generate_totp_secret()
    user = PlatformUser(
        email=normalized_email,
        password_hash=hash_password(password),
        role=role,
        totp_secret_ciphertext=encrypt_totp_secret(secret),
        totp_key_version=get_settings().platform_totp_active_key_version,
        active=True,
    )
    session.add(user)
    session.flush()
    return user, secret


def write_enrollment_secret(path: Path, secret: str) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(fd, (secret + "\n").encode())
    finally:
        os.close(fd)
