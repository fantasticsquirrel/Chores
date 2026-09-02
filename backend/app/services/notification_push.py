"""Push notification queueing, delivery, and retry mechanics."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
import json
from pathlib import Path
from typing import Any, Callable

from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session

from app.models.core import Household, Notification, NotificationDeliveryAttempt, PushSubscription, User
from app.security.outbound_urls import UnsafeOutboundUrl, validate_push_endpoint
from app.services.notification_preferences import get_user_notification_settings, quiet_hours_end

PUSH_TIMEOUT_SECONDS = 5
MAX_PUSH_ATTEMPTS = 3


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _db_datetime(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def enqueue_push_delivery_attempts(session: Session, notification: Notification) -> None:
    """Queue one delivery attempt for each active subscription, without network I/O."""
    subscriptions = list(
        session.scalars(
            select(PushSubscription).where(
                PushSubscription.user_id == notification.user_id,
                PushSubscription.enabled.is_(True),
            )
        ).all()
    )
    for subscription in subscriptions:
        channel = f"push:{subscription.id}"
        duplicate = session.scalar(
            select(NotificationDeliveryAttempt).where(
                NotificationDeliveryAttempt.notification_id == notification.id,
                NotificationDeliveryAttempt.channel == channel,
            )
        )
        if duplicate is None:
            session.add(
                NotificationDeliveryAttempt(
                    notification_id=notification.id,
                    channel=channel,
                    status="pending",
                    attempted_at=_db_datetime(_utc_now()),
                    error_message="attempts=0",
                )
            )


def _private_key() -> str:
    from app.config import get_settings

    value = get_settings().push_vapid_private_key
    if not value:
        return ""
    try:
        path = Path(value)
        if path.is_file():
            return path.read_text()
    except OSError:
        pass
    return value


def _default_sender(**kwargs: Any) -> Any:
    import requests
    from pywebpush import webpush

    kwargs.pop("allow_redirects", None)

    class _NoRedirectSession(requests.Session):
        def request(self, *args: Any, **request_kwargs: Any) -> Any:
            request_kwargs["allow_redirects"] = False
            return super().request(*args, **request_kwargs)

    with _NoRedirectSession() as session:
        kwargs["requests_session"] = session
        return webpush(**kwargs)


def _attempt_count(attempt: NotificationDeliveryAttempt) -> int:
    prefix = (attempt.error_message or "").split(";", 1)[0]
    try:
        return int(prefix.removeprefix("attempts="))
    except ValueError:
        return 0


def process_pending_push_deliveries(
    *,
    limit: int = 100,
    now: datetime | None = None,
    sender: Callable[..., Any] = _default_sender,
) -> dict[str, int]:
    from app.config import get_settings
    from app.db import get_session_factory

    current = now or _utc_now()
    current_db = _db_datetime(current)
    factory = get_session_factory(get_settings().database_url)
    counts: dict[str, int] = {}
    with factory() as session:
        eligible_for_claim = or_(
            NotificationDeliveryAttempt.status == "pending",
            and_(
                NotificationDeliveryAttempt.status == "retry",
                NotificationDeliveryAttempt.attempted_at <= current_db,
            ),
            and_(
                NotificationDeliveryAttempt.status == "processing",
                NotificationDeliveryAttempt.attempted_at <= current_db - timedelta(minutes=5),
            ),
        )
        candidate_ids = list(
            session.scalars(
                select(NotificationDeliveryAttempt.id)
                .where(eligible_for_claim)
                .order_by(NotificationDeliveryAttempt.id)
                .limit(limit)
            ).all()
        )
        claimed_ids: list[int] = []
        for attempt_id in candidate_ids:
            result = session.execute(
                update(NotificationDeliveryAttempt)
                .where(NotificationDeliveryAttempt.id == attempt_id, eligible_for_claim)
                .values(status="processing", attempted_at=current_db)
            )
            if result.rowcount == 1:
                claimed_ids.append(attempt_id)
        session.commit()
        attempts = [
            attempt
            for attempt_id in claimed_ids
            if (attempt := session.get(NotificationDeliveryAttempt, attempt_id)) is not None
        ]
        for attempt in attempts:
            try:
                subscription_id = int(attempt.channel.split(":", 1)[1])
            except (IndexError, ValueError):
                attempt.status = "dead"
                attempt.error_message = "attempts=0;invalid queue channel"
                counts["dead"] = counts.get("dead", 0) + 1
                continue
            notification = session.get(Notification, attempt.notification_id)
            subscription = session.get(PushSubscription, subscription_id)
            if notification is None or subscription is None or not subscription.enabled:
                attempt.status = "disabled"
                counts["disabled"] = counts.get("disabled", 0) + 1
                continue
            if subscription.user_id != notification.user_id:
                attempt.status = "dead"
                attempt.error_message = "attempts=0;subscription ownership mismatch"
                counts["dead"] = counts.get("dead", 0) + 1
                continue
            user = session.get(User, notification.user_id)
            household = session.get(Household, notification.household_id)
            if user is None or household is None or user.household_id != notification.household_id:
                attempt.status = "dead"
                counts["dead"] = counts.get("dead", 0) + 1
                continue
            user_settings = get_user_notification_settings(session, user.id).get(notification.module_key, {})
            quiet_until = quiet_hours_end(current, household.timezone, user_settings)
            if quiet_until is not None:
                attempt.status = "retry"
                attempt.attempted_at = _db_datetime(quiet_until)
                attempt.error_message = f"attempts={_attempt_count(attempt)};quiet-hours"
                counts["retry"] = counts.get("retry", 0) + 1
                continue
            try:
                validate_push_endpoint(subscription.endpoint)
                response = sender(
                    subscription_info={
                        "endpoint": subscription.endpoint,
                        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                    },
                    data=json.dumps(
                        {"title": notification.title, "body": notification.body, "link_url": notification.link_url}
                    )[:4096],
                    vapid_private_key=_private_key(),
                    vapid_claims={"sub": get_settings().push_vapid_claims_sub},
                    timeout=PUSH_TIMEOUT_SECONDS,
                    allow_redirects=False,
                )
                status_code = getattr(response, "status_code", 201)
                if status_code in {404, 410}:
                    raise _GoneSubscription(status_code)
                if not 200 <= status_code < 300:
                    raise RuntimeError(f"push service returned {status_code}")
                attempt.status = "sent"
                attempt.attempted_at = current_db
                attempt.error_message = ""
                counts["sent"] = counts.get("sent", 0) + 1
            except Exception as exc:  # Worker must persist bounded failure state and continue.
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if isinstance(exc, UnsafeOutboundUrl) or isinstance(exc, _GoneSubscription) or status_code in {404, 410}:
                    subscription.enabled = False
                    subscription.disabled_at = current_db
                    attempt.status = "disabled"
                    attempt.attempted_at = current_db
                    attempt.error_message = f"attempts={_attempt_count(attempt) + 1};{str(exc)[:900]}"
                    counts["disabled"] = counts.get("disabled", 0) + 1
                    continue
                failures = _attempt_count(attempt) + 1
                attempt.attempted_at = _db_datetime(current + timedelta(minutes=(2 if failures == 1 else 8)))
                attempt.error_message = f"attempts={failures};{str(exc)[:900]}"
                attempt.status = "dead" if failures >= MAX_PUSH_ATTEMPTS else "retry"
                counts[attempt.status] = counts.get(attempt.status, 0) + 1
        session.commit()
    return counts


class _GoneSubscription(RuntimeError):
    def __init__(self, status_code: int) -> None:
        super().__init__(f"push subscription returned {status_code}")
        self.response = type("Response", (), {"status_code": status_code})()


__all__ = [
    "MAX_PUSH_ATTEMPTS",
    "PUSH_TIMEOUT_SECONDS",
    "enqueue_push_delivery_attempts",
    "process_pending_push_deliveries",
]
