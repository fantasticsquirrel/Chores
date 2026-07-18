from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import PlatformRole
from app.models.platform import PlatformUser
from app.security.passwords import hash_password
from app.security.totp import generate_totp_secret


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
        totp_secret=secret,
        active=True,
    )
    session.add(user)
    session.flush()
    return user, secret
