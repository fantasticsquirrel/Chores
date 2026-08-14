from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import secrets

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.core import AuthSession, User

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
    expected_session_generation: int | None = None,
) -> str | None:
    """Issue a session only for the current credential generation.

    Callers pass the generation they verified with the password. The conditional
    lookup is the commit-time race boundary: a password reset can increment the
    user generation between verification and session insertion, in which case no
    session is created.
    """
    if expected_session_generation is None:
        generation = session.scalar(select(User.session_generation).where(User.id == user_id))
        if generation is None:
            return None
    else:
        generation = expected_session_generation
    token = secrets.token_urlsafe(48)
    issued_at = datetime.now(UTC)
    result = session.execute(
        update(User)
        .where(User.id == user_id, User.session_generation == generation)
        .values(session_generation=User.session_generation)
    )
    if result.rowcount != 1:
        return None
    session.add(
        AuthSession(
            user_id=user_id,
            session_generation=generation,
            token_hash=hash_session_token(token),
            expires_at=issued_at + timedelta(seconds=max_age_seconds),
            ip_address=ip_address,
            user_agent=user_agent[:500],
            created_at=issued_at,
        )
    )
    session.flush()
    return token


def resolve_session(session: Session, token: str) -> AuthSession | None:
    row = session.scalar(
        select(AuthSession)
        .join(User, User.id == AuthSession.user_id)
        .where(
            AuthSession.token_hash == hash_session_token(token),
            AuthSession.session_generation == User.session_generation,
        )
    )
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
    """Atomically invalidate every issued session for a credential transition.

    The generation bump is the authoritative invalidation boundary. The sweep is
    retained for auditability and immediate cleanup, while session resolution
    rejects any row that escaped the sweep because it was committed by a racing
    old-password login.
    """
    session.execute(
        update(User)
        .where(User.id == user_id)
        .values(session_generation=User.session_generation + 1)
    )
    session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
