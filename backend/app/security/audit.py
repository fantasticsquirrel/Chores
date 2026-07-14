from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import ipaddress
import json

from fastapi import Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.core import LoginAttempt, SecurityAuditEvent, User


def request_ip(request: Request) -> str:
    peer = request.client.host if request.client is not None else ""
    value = peer
    try:
        trusted_proxy = ipaddress.ip_address(peer).is_loopback
    except ValueError:
        trusted_proxy = False
    if trusted_proxy:
        # nginx overwrites X-Real-IP at the only supported proxy boundary.
        value = request.headers.get("x-real-ip", "").strip() or peer
    return (value or "unknown")[:64]


def account_key_hash(kind: str, *parts: str) -> str:
    normalized = "|".join(part.strip().lower() for part in parts)
    return hashlib.sha256(f"{kind}|{normalized}".encode()).hexdigest()


def retry_after_seconds(session: Session, settings: Settings, key_hash: str, ip: str) -> int | None:
    cutoff = datetime.now(UTC) - timedelta(seconds=settings.login_window_seconds)
    session.execute(delete(LoginAttempt).where(LoginAttempt.created_at < cutoff))
    attempts = session.scalar(
        select(func.count(LoginAttempt.id)).where(
            LoginAttempt.succeeded.is_(False),
            LoginAttempt.created_at >= cutoff,
            or_(LoginAttempt.account_key_hash == key_hash, LoginAttempt.ip_address == ip),
        )
    ) or 0
    return settings.login_window_seconds if attempts >= settings.login_max_attempts else None


def record_login_attempt(session: Session, key_hash: str, ip: str, *, succeeded: bool) -> None:
    if succeeded:
        session.execute(
            delete(LoginAttempt).where(
                LoginAttempt.succeeded.is_(False),
                LoginAttempt.account_key_hash == key_hash,
            )
        )
    session.add(LoginAttempt(account_key_hash=key_hash, ip_address=ip, succeeded=succeeded))


def audit(
    session: Session,
    event_type: str,
    *,
    request: Request | None = None,
    actor: User | None = None,
    target: User | None = None,
    household_id: int | None = None,
    details: dict[str, object] | None = None,
) -> None:
    session.add(
        SecurityAuditEvent(
            event_type=event_type,
            actor_user_id=actor.id if actor else None,
            target_user_id=target.id if target else None,
            household_id=household_id if household_id is not None else (actor.household_id if actor else None),
            ip_address=request_ip(request) if request else "internal",
            details_json=json.dumps(details or {}, sort_keys=True, separators=(",", ":")),
        )
    )
