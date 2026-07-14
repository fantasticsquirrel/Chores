from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
import json
import math
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app.models.core import (
    Child,
    Chore,
    Household,
    Notification,
    NotificationDeliveryAttempt,
    NotificationPreference,
    PushSubscription,
    Submission,
    SubmissionItem,
    User,
)
from app.models.enums import SubmissionStatus, UserRole
from app.security.outbound_urls import UnsafeOutboundUrl, validate_push_endpoint
from app.services.chores.workflow import _eligible_chores_for_child

MODULE_CHORES = "chores"
PUSH_TIMEOUT_SECONDS = 5
MAX_PUSH_ATTEMPTS = 3

DEFAULT_CHORE_NOTIFICATION_SETTINGS: dict[str, Any] = {
    "in_app_enabled": True,
    "push_enabled": False,
    "daily_digest_enabled": True,
    "daily_digest_time": "08:00",
    "due_soon_enabled": True,
    "due_soon_hours": 24,
    "approval_notifications_enabled": True,
    "quiet_hours_start": "21:00",
    "quiet_hours_end": "07:00",
}


def utc_now() -> datetime:
    return datetime.now(UTC)


def _db_datetime(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def _merged_settings(raw: str | None) -> dict[str, Any]:
    values = dict(DEFAULT_CHORE_NOTIFICATION_SETTINGS)
    if raw:
        try:
            decoded = json.loads(raw)
        except json.JSONDecodeError:
            decoded = {}
        if isinstance(decoded, dict):
            values.update(decoded)
    return values


def get_user_notification_settings(session: Session, user_id: int) -> dict[str, dict[str, Any]]:
    row = session.scalar(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.module_key == MODULE_CHORES,
        )
    )
    return {MODULE_CHORES: _merged_settings(row.settings_json if row else None)}


def update_user_notification_settings(session: Session, user_id: int, module_key: str, updates: dict[str, Any]) -> dict[str, Any]:
    if module_key != MODULE_CHORES:
        raise ValueError("Unsupported notification module.")
    row = session.scalar(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.module_key == module_key,
        )
    )
    settings = _merged_settings(row.settings_json if row else None)
    clean_updates = {key: value for key, value in updates.items() if value is not None and key in settings}
    settings.update(clean_updates)
    if row is None:
        row = NotificationPreference(user_id=user_id, module_key=module_key, settings_json=json.dumps(settings), updated_at=utc_now())
        session.add(row)
    else:
        row.settings_json = json.dumps(settings)
        row.updated_at = utc_now()
    session.commit()
    return settings


def create_notification(
    session: Session,
    *,
    household_id: int,
    user_id: int,
    module_key: str = MODULE_CHORES,
    category: str,
    severity: str = "info",
    title: str,
    body: str,
    link_url: str = "",
    dedup_key: str | None = None,
    child_id: int | None = None,
    expires_at: datetime | None = None,
) -> Notification | None:
    settings = get_user_notification_settings(session, user_id).get(module_key, {})
    in_app_visible = settings.get("in_app_enabled") is not False
    push_requested = settings.get("push_enabled") is True
    if not in_app_visible and not push_requested:
        return None
    if category == "approval" and settings.get("approval_notifications_enabled") is False:
        return None
    if dedup_key is not None:
        existing = session.scalar(select(Notification).where(Notification.user_id == user_id, Notification.dedup_key == dedup_key))
        if existing is not None:
            return None
    notification = Notification(
        household_id=household_id,
        user_id=user_id,
        child_id=child_id,
        module_key=module_key,
        category=category,
        severity=severity,
        title=title,
        body=body,
        link_url=link_url,
        dedup_key=dedup_key,
        expires_at=expires_at,
        in_app_visible=in_app_visible,
    )
    session.add(notification)
    session.flush()
    _enqueue_push_if_enabled(session, notification, settings)
    return notification


def _enqueue_push_if_enabled(session: Session, notification: Notification, settings: dict[str, Any]) -> None:
    from app.config import get_settings

    if settings.get("push_enabled") is not True or not get_settings().push_vapid_private_key:
        return
    subscriptions = list(
        session.scalars(
            select(PushSubscription).where(PushSubscription.user_id == notification.user_id, PushSubscription.enabled.is_(True))
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
                    attempted_at=_db_datetime(utc_now()),
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


def _timezone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _quiet_end(now: datetime, household: Household, settings: dict[str, Any]) -> datetime | None:
    start_raw = settings.get("quiet_hours_start") or ""
    end_raw = settings.get("quiet_hours_end") or ""
    if not start_raw or not end_raw or start_raw == end_raw:
        return None
    try:
        start = time.fromisoformat(start_raw)
        end = time.fromisoformat(end_raw)
    except ValueError:
        return None
    zone = _timezone(household.timezone)
    local = now.astimezone(zone)
    local_time = local.timetz().replace(tzinfo=None)
    in_quiet = (local_time >= start or local_time < end) if start > end else start <= local_time < end
    if not in_quiet:
        return None
    end_date = local.date() + timedelta(days=1 if start > end and local_time >= start else 0)
    return datetime.combine(end_date, end, tzinfo=zone).astimezone(UTC)


def process_pending_push_deliveries(
    *,
    limit: int = 100,
    now: datetime | None = None,
    sender: Callable[..., Any] = _default_sender,
) -> dict[str, int]:
    from app.config import get_settings
    from app.db import get_session_factory

    current = now or utc_now()
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
        attempts = [attempt for attempt_id in claimed_ids if (attempt := session.get(NotificationDeliveryAttempt, attempt_id)) is not None]
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
            user = session.get(User, notification.user_id)
            household = session.get(Household, notification.household_id)
            if user is None or household is None:
                attempt.status = "dead"
                counts["dead"] = counts.get("dead", 0) + 1
                continue
            user_settings = get_user_notification_settings(session, user.id).get(notification.module_key, {})
            quiet_until = _quiet_end(current, household, user_settings)
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
                    data=json.dumps({"title": notification.title, "body": notification.body, "link_url": notification.link_url})[:4096],
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


def notify_submission_created(session: Session, submission: Submission) -> int:
    child = session.get(Child, submission.child_id)
    child_name = child.name if child is not None else "A child"
    item_count = session.scalar(select(func.count()).select_from(SubmissionItem).where(SubmissionItem.submission_id == submission.id)) or 0
    recipients = list(session.scalars(select(User).where(User.household_id == submission.household_id, User.role.in_([UserRole.PARENT, UserRole.PARENT_ADMIN]))).all())
    created = 0
    for user in recipients:
        result = create_notification(
            session,
            household_id=submission.household_id,
            user_id=user.id,
            category="approval",
            title="Chore ready for review",
            body=f"{child_name} submitted {item_count} chore{'s' if item_count != 1 else ''} for approval.",
            link_url="/chore/board",
            dedup_key=f"chores:submission:{submission.id}:parent:{user.id}",
            child_id=submission.child_id,
        )
        if result is not None:
            created += 1
    return created


def notify_submission_approved(session: Session, submission: Submission) -> int:
    child_user = session.scalar(select(User).where(User.household_id == submission.household_id, User.child_id == submission.child_id, User.role == UserRole.CHILD))
    if child_user is None:
        return 0
    item_rows = list(session.scalars(select(SubmissionItem).where(SubmissionItem.submission_id == submission.id)).all())
    chore_ids = [item.chore_id for item in item_rows if item.status == SubmissionStatus.APPROVED]
    names = [row.name for row in session.scalars(select(Chore).where(Chore.id.in_(chore_ids))).all()] if chore_ids else []
    created = create_notification(
        session,
        household_id=submission.household_id,
        user_id=child_user.id,
        category="approval",
        title="Chore approved",
        body=f"Approved: {', '.join(names) if names else 'your chore submission'}.",
        link_url="/chore/child/today",
        dedup_key=f"chores:submission:{submission.id}:approved:child:{child_user.id}",
        child_id=submission.child_id,
    )
    return 1 if created is not None else 0


def generate_daily_chore_reminders(target_date: date) -> int:
    from app.config import get_settings
    from app.db import get_session_factory

    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        created = _generate_daily(session, target_date)
        session.commit()
        return created


def _generate_daily(session: Session, target_date: date, *, only_user_id: int | None = None) -> int:
    query = select(User).where(User.role == UserRole.CHILD, User.child_id.is_not(None))
    if only_user_id is not None:
        query = query.where(User.id == only_user_id)
    created = 0
    for user in session.scalars(query).all():
        settings = get_user_notification_settings(session, user.id)[MODULE_CHORES]
        if not settings.get("daily_digest_enabled", True):
            continue
        child = session.get(Child, user.child_id)
        if child is None or not child.active:
            continue
        eligible = _eligible_chores_for_child(session, child, target_date)
        if not eligible:
            continue
        names = ", ".join(item.name for item in eligible[:3])
        if len(eligible) > 3:
            names += f", and {len(eligible) - 3} more"
        result = create_notification(
            session,
            household_id=user.household_id,
            user_id=user.id,
            category="reminder",
            title="Today's chores are ready",
            body=f"You have {len(eligible)} chore{'s' if len(eligible) != 1 else ''} ready today: {names}.",
            link_url="/chore/child/today",
            dedup_key=f"chores:daily:{user.id}:{target_date.isoformat()}",
            child_id=child.id,
        )
        created += int(result is not None)
    return created


def run_notification_scheduler(*, now: datetime | None = None) -> dict[str, int]:
    from app.config import get_settings
    from app.db import get_session_factory

    current = now or utc_now()
    factory = get_session_factory(get_settings().database_url)
    counts: dict[str, int] = {}
    with factory() as session:
        child_users = list(session.scalars(select(User).where(User.role == UserRole.CHILD, User.child_id.is_not(None))).all())
        for user in child_users:
            household = session.get(Household, user.household_id)
            child = session.get(Child, user.child_id)
            if household is None or child is None or not child.active:
                continue
            local = current.astimezone(_timezone(household.timezone))
            settings = get_user_notification_settings(session, user.id)[MODULE_CHORES]
            if settings.get("due_soon_enabled", True):
                hours = int(settings.get("due_soon_hours", 24))
                days = max(1, math.ceil(hours / 24))
                for offset in range(1, days + 1):
                    target = local.date() + timedelta(days=offset)
                    eligible = _eligible_chores_for_child(session, child, target)
                    if not eligible:
                        continue
                    result = create_notification(
                        session,
                        household_id=user.household_id,
                        user_id=user.id,
                        category="due_soon",
                        title="Chores due soon",
                        body=f"{len(eligible)} chore{'s are' if len(eligible) != 1 else ' is'} coming up.",
                        link_url="/chore/child/today",
                        dedup_key=f"chores:due-soon:{user.id}:{target.isoformat()}",
                        child_id=child.id,
                    )
                    counts["due_soon"] = counts.get("due_soon", 0) + int(result is not None)
                    break
            if settings.get("daily_digest_enabled", True):
                try:
                    digest_time = time.fromisoformat(str(settings.get("daily_digest_time", "08:00")))
                except ValueError:
                    digest_time = time(8, 0)
                scheduled = datetime.combine(local.date(), digest_time, tzinfo=local.tzinfo)
                if scheduled <= local < scheduled + timedelta(minutes=15):
                    made = _generate_daily(session, local.date(), only_user_id=user.id)
                    counts["daily_digest"] = counts.get("daily_digest", 0) + made
        session.commit()
    return {key: value for key, value in counts.items() if value}


def upsert_push_subscription(session: Session, *, user_id: int, endpoint: str, p256dh: str, auth: str, device_label: str) -> PushSubscription:
    validate_push_endpoint(endpoint)
    existing = session.scalar(select(PushSubscription).where(PushSubscription.user_id == user_id, PushSubscription.endpoint == endpoint))
    now = utc_now()
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
    now = utc_now()
    rows = list(session.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id, PushSubscription.enabled.is_(True))).all())
    for row in rows:
        row.enabled = False
        row.disabled_at = now
    session.commit()
    return len(rows)
