"""Push subscription validation and lifecycle management."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PushSubscription
from app.security.outbound_urls import validate_push_endpoint


def upsert_push_subscription(session: Session, *, user_id: int, endpoint: str, p256dh: str, auth: str, device_label: str) -> PushSubscription:
    validate_push_endpoint(endpoint)
    existing = session.scalar(select(PushSubscription).where(
        PushSubscription.user_id == user_id,
        PushSubscription.endpoint == endpoint,
    ))
    now = datetime.now(UTC)
    if existing is None:
        existing = PushSubscription(user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth, device_label=device_label, enabled=True, last_seen_at=now)
        session.add(existing)
    else:
        existing.p256dh = p256dh
        existing.auth = auth
        existing.device_label = device_label
        existing.enabled = True
        existing.disabled_at = None
        existing.last_seen_at = now
    session.commit()
    session.refresh(existing)
    return existing


def disable_push_subscriptions(session: Session, *, user_id: int) -> int:
    now = datetime.now(UTC)
    rows = list(session.scalars(select(PushSubscription).where(
        PushSubscription.user_id == user_id,
        PushSubscription.enabled.is_(True),
    )).all())
    for row in rows:
        row.enabled = False
        row.disabled_at = now
    session.commit()
    return len(rows)


__all__ = ["disable_push_subscriptions", "upsert_push_subscription"]
