"""Notification persistence policy and delivery queue orchestration."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification
from app.services.notification_preferences import MODULE_CHORES, get_user_notification_settings
from app.services.notification_push import enqueue_push_delivery_attempts


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


def _enqueue_push_if_enabled(
    session: Session,
    notification: Notification,
    settings: dict[str, Any],
) -> None:
    from app.config import get_settings

    if settings.get("push_enabled") is not True or not get_settings().push_vapid_private_key:
        return
    enqueue_push_delivery_attempts(session, notification)


__all__ = ["create_notification", "utc_now"]
