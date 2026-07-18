from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform import PlatformSession

OPS_SESSION_COOKIE_NAME = "family_ops_session"
OPS_CSRF_COOKIE_NAME = "family_ops_csrf"
OPS_CSRF_HEADER_NAME = "X-Ops-CSRF-Token"
OPS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8
RECENT_REAUTH_SECONDS = 15 * 60


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_platform_session(session: Session, user_id: int) -> tuple[str, str, PlatformSession]:
    token = secrets.token_urlsafe(48)
    csrf = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    row = PlatformSession(platform_user_id=user_id, token_hash=hash_token(token), expires_at=now + timedelta(seconds=OPS_SESSION_MAX_AGE_SECONDS), mfa_verified_at=now, recent_reauth_at=now)
    session.add(row)
    session.flush()
    return token, csrf, row


def resolve_platform_session(session: Session, token: str | None) -> PlatformSession | None:
    if not token:
        return None
    row = session.scalar(select(PlatformSession).where(PlatformSession.token_hash == hash_token(token)))
    if row is None or row.revoked_at is not None:
        return None
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=UTC)
    return row if expires > datetime.now(UTC) else None


def has_recent_reauth(row: PlatformSession) -> bool:
    value = row.recent_reauth_at if row.recent_reauth_at.tzinfo else row.recent_reauth_at.replace(tzinfo=UTC)
    return value >= datetime.now(UTC) - timedelta(seconds=RECENT_REAUTH_SECONDS)
