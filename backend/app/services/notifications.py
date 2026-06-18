from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.core import Child, Chore, Notification, NotificationDeliveryAttempt, NotificationPreference, PushSubscription, Submission, SubmissionItem, User
from app.models.enums import SubmissionStatus, UserRole
from app.services.chores.workflow import _eligible_chores_for_child

MODULE_CHORES = "chores"

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
    if settings.get("in_app_enabled") is False:
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
    )
    session.add(notification)
    session.flush()
    _deliver_push_if_enabled(session, notification)
    return notification


def _deliver_push_if_enabled(session: Session, notification: Notification) -> None:
    from app.config import get_settings

    settings = get_user_notification_settings(session, notification.user_id).get(notification.module_key, {})
    if settings.get("push_enabled") is not True:
        return
    app_settings = get_settings()
    if not app_settings.push_vapid_private_key:
        return
    subscriptions = list(
        session.scalars(
            select(PushSubscription).where(PushSubscription.user_id == notification.user_id, PushSubscription.enabled.is_(True))
        ).all()
    )
    if not subscriptions:
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        for subscription in subscriptions:
            session.add(
                NotificationDeliveryAttempt(
                    notification_id=notification.id,
                    channel="push",
                    status="skipped",
                    attempted_at=utc_now(),
                    error_message="pywebpush is not installed.",
                )
            )
        return

    private_key = app_settings.push_vapid_private_key
    try:
        from pathlib import Path
        private_path = Path(private_key)
        if private_path.exists():
            private_key = private_path.read_text()
    except OSError:
        pass
    payload = json.dumps({"title": notification.title, "body": notification.body, "link_url": notification.link_url})
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": app_settings.push_vapid_claims_sub},
            )
            session.add(
                NotificationDeliveryAttempt(
                    notification_id=notification.id,
                    channel="push",
                    status="sent",
                    attempted_at=utc_now(),
                    error_message="",
                )
            )
        except WebPushException as exc:
            subscription.enabled = False if getattr(getattr(exc, "response", None), "status_code", None) in {404, 410} else subscription.enabled
            session.add(
                NotificationDeliveryAttempt(
                    notification_id=notification.id,
                    channel="push",
                    status="failed",
                    attempted_at=utc_now(),
                    error_message=str(exc)[:1000],
                )
            )


def notify_submission_created(session: Session, submission: Submission) -> int:
    child = session.get(Child, submission.child_id)
    child_name = child.name if child is not None else "A child"
    item_count = session.scalar(select(func.count()).select_from(SubmissionItem).where(SubmissionItem.submission_id == submission.id)) or 0
    recipients = list(
        session.scalars(
            select(User).where(
                User.household_id == submission.household_id,
                User.role.in_([UserRole.PARENT, UserRole.PARENT_ADMIN]),
            )
        ).all()
    )
    created = 0
    for user in recipients:
        result = create_notification(
            session,
            household_id=submission.household_id,
            user_id=user.id,
            category="approval",
            title="Chore ready for review",
            body=f"{child_name} submitted {item_count} chore{'s' if item_count != 1 else ''} for approval.",
            link_url="/board",
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
    body_names = ", ".join(names) if names else "your chore submission"
    created = create_notification(
        session,
        household_id=submission.household_id,
        user_id=child_user.id,
        category="approval",
        title="Chore approved",
        body=f"Approved: {body_names}.",
        link_url="/child/today",
        dedup_key=f"chores:submission:{submission.id}:approved:child:{child_user.id}",
        child_id=submission.child_id,
    )
    return 1 if created is not None else 0


def generate_daily_chore_reminders(target_date: date) -> int:
    from app.config import get_settings
    from app.db import get_session_factory

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        created = 0
        child_users = list(session.scalars(select(User).where(User.role == UserRole.CHILD, User.child_id.is_not(None))).all())
        for user in child_users:
            user_settings = get_user_notification_settings(session, user.id)[MODULE_CHORES]
            if not user_settings.get("daily_digest_enabled", True):
                continue
            child = session.get(Child, user.child_id)
            if child is None or not child.active:
                continue
            eligible = _eligible_chores_for_child(session, child, target_date)
            if not eligible:
                continue
            chore_names = ", ".join(item.name for item in eligible[:3])
            if len(eligible) > 3:
                chore_names += f", and {len(eligible) - 3} more"
            result = create_notification(
                session,
                household_id=user.household_id,
                user_id=user.id,
                category="reminder",
                title="Today's chores are ready",
                body=f"You have {len(eligible)} chore{'s' if len(eligible) != 1 else ''} ready today: {chore_names}.",
                link_url="/child/today",
                dedup_key=f"chores:daily:{user.id}:{target_date.isoformat()}",
                child_id=child.id,
            )
            if result is not None:
                created += 1
        session.commit()
        return created


def upsert_push_subscription(session: Session, *, user_id: int, endpoint: str, p256dh: str, auth: str, device_label: str) -> PushSubscription:
    existing = session.scalar(select(PushSubscription).where(PushSubscription.user_id == user_id, PushSubscription.endpoint == endpoint))
    now = utc_now()
    if existing is None:
        existing = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            device_label=device_label,
            enabled=True,
            last_seen_at=now,
        )
        session.add(existing)
    else:
        existing.p256dh = p256dh
        existing.auth = auth
        existing.device_label = device_label
        existing.enabled = True
        existing.last_seen_at = now
    session.commit()
    session.refresh(existing)
    return existing
