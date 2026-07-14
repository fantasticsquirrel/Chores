from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import secrets

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.core import AuthSession

SESSION_COOKIE_NAME = "chore_tracker_session"
SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session_token(
    session: Session,
    user_id: int,
    *,
    max_age_seconds: int,
    ip_address: str = "",
    user_agent: str = "",
) -> str:
    token = secrets.token_urlsafe(48)
    session.add(
        AuthSession(
            user_id=user_id,
            token_hash=hash_session_token(token),
            expires_at=datetime.now(UTC) + timedelta(seconds=max_age_seconds),
            ip_address=ip_address,
            user_agent=user_agent[:500],
        )
    )
    session.flush()
    return token


def resolve_session(session: Session, token: str) -> AuthSession | None:
    row = session.scalar(select(AuthSession).where(AuthSession.token_hash == hash_session_token(token)))
    if row is None or row.revoked_at is not None:
        return None
    expires_at = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        return None
    return row


def revoke_session(session: Session, token: str) -> bool:
    row = resolve_session(session, token)
    if row is None:
        return False
    row.revoked_at = datetime.now(UTC)
    session.flush()
    return True


def revoke_user_sessions(session: Session, user_id: int) -> None:
    session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
