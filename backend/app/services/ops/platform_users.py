"""Platform-user authentication, session mutation, and safe presentation helpers."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform import PlatformSession, PlatformUser
from app.security.passwords import verify_password
from app.security.totp import verify_totp
from app.security.totp_crypto import decrypt_totp_secret


def authenticate_platform_user(
    session: Session,
    *,
    email: str,
    password: str,
    totp_code: str,
) -> PlatformUser | None:
    user = session.scalar(
        select(PlatformUser).where(PlatformUser.email == email.lower())
    )
    if user is None or not user.active:
        return None
    if not platform_user_credentials_are_valid(user, password, totp_code):
        return None
    return user


def platform_user_credentials_are_valid(
    user: PlatformUser,
    password: str,
    totp_code: str,
) -> bool:
    if not verify_password(password, user.password_hash):
        return False
    secret = decrypt_totp_secret(
        user.totp_secret_ciphertext,
        user.totp_key_version,
    )
    return verify_totp(secret, totp_code)


def mark_platform_session_reauthenticated(
    auth_session: PlatformSession,
    *,
    at: datetime | None = None,
) -> None:
    auth_session.recent_reauth_at = at or datetime.now(UTC)


def revoke_platform_session(
    auth_session: PlatformSession,
    *,
    at: datetime | None = None,
) -> None:
    auth_session.revoked_at = at or datetime.now(UTC)


def platform_user_dict(user: PlatformUser) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "mfa_required": True,
        "mfa_verified": True,
    }


def redact_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def redacted_platform_user_email(
    session: Session,
    platform_user_id: int,
) -> str:
    operator = session.get(PlatformUser, platform_user_id)
    return redact_email(operator.email) if operator is not None else "***"
