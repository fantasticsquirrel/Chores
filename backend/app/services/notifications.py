"""Compatibility facade for notification services."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.core import Child, Chore, Notification, Submission, SubmissionItem, User
from app.models.enums import SubmissionStatus, UserRole
from app.services import notification_reminders
from app.services.notification_preferences import (
    DEFAULT_CHORE_NOTIFICATION_SETTINGS,
    MODULE_CHORES,
    get_user_notification_settings,
    update_user_notification_settings,
)
from app.services.notification_push import (
    MAX_PUSH_ATTEMPTS,
    PUSH_TIMEOUT_SECONDS,
    enqueue_push_delivery_attempts,
    process_pending_push_deliveries,
)
from app.services.push_subscriptions import disable_push_subscriptions, upsert_push_subscription


def utc_now() -> datetime:
    return datetime.now(UTC)


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
        existing = session.scalar(
            select(Notification).where(Notification.user_id == user_id, Notification.dedup_key == dedup_key)
        )
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
    enqueue_push_delivery_attempts(session, notification)


def notify_submission_created(session: Session, submission: Submission) -> int:
    child = session.get(Child, submission.child_id)
    child_name = child.name if child is not None else "A child"
    item_count = (
        session.scalar(
            select(func.count()).select_from(SubmissionItem).where(SubmissionItem.submission_id == submission.id)
        )
        or 0
    )
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
            link_url="/chore/board",
            dedup_key=f"chores:submission:{submission.id}:parent:{user.id}",
            child_id=submission.child_id,
        )
        if result is not None:
            created += 1
    return created


def notify_submission_approved(session: Session, submission: Submission) -> int:
    child_user = session.scalar(
        select(User).where(
            User.household_id == submission.household_id,
            User.child_id == submission.child_id,
            User.role == UserRole.CHILD,
        )
    )
    if child_user is None:
        return 0
    item_rows = list(
        session.scalars(select(SubmissionItem).where(SubmissionItem.submission_id == submission.id)).all()
    )
    chore_ids = [item.chore_id for item in item_rows if item.status == SubmissionStatus.APPROVED]
    names = (
        [row.name for row in session.scalars(select(Chore).where(Chore.id.in_(chore_ids))).all()]
        if chore_ids
        else []
    )
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
    return notification_reminders.generate_daily_chore_reminders(
        target_date,
        create_notification=create_notification,
    )


def run_notification_scheduler(*, now: datetime | None = None) -> dict[str, int]:
    return notification_reminders.run_notification_scheduler(
        now=now,
        create_notification=create_notification,
    )
