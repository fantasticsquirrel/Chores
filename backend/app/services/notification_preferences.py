"""Notification preference defaults, persistence, and merging."""

from datetime import UTC, datetime, time, timedelta
import json
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import NotificationPreference

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
    row = session.scalar(select(NotificationPreference).where(
        NotificationPreference.user_id == user_id,
        NotificationPreference.module_key == MODULE_CHORES,
    ))
    return {MODULE_CHORES: _merged_settings(row.settings_json if row else None)}


def update_user_notification_settings(session: Session, user_id: int, module_key: str, updates: dict[str, Any]) -> dict[str, Any]:
    if module_key != MODULE_CHORES:
        raise ValueError("Unsupported notification module.")
    row = session.scalar(select(NotificationPreference).where(
        NotificationPreference.user_id == user_id,
        NotificationPreference.module_key == module_key,
    ))
    settings = _merged_settings(row.settings_json if row else None)
    settings.update({key: value for key, value in updates.items() if value is not None and key in settings})
    now = datetime.now(UTC)
    if row is None:
        session.add(NotificationPreference(user_id=user_id, module_key=module_key, settings_json=json.dumps(settings), updated_at=now))
    else:
        row.settings_json = json.dumps(settings)
        row.updated_at = now
    session.commit()
    return settings


def quiet_hours_end(
    now: datetime,
    timezone_name: str,
    settings: dict[str, Any],
) -> datetime | None:
    start_raw = settings.get("quiet_hours_start") or ""
    end_raw = settings.get("quiet_hours_end") or ""
    if not start_raw or not end_raw or start_raw == end_raw:
        return None
    try:
        start = time.fromisoformat(start_raw)
        end = time.fromisoformat(end_raw)
    except ValueError:
        return None
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        zone = ZoneInfo("UTC")
    local = now.astimezone(zone)
    local_time = local.timetz().replace(tzinfo=None)
    in_quiet = (local_time >= start or local_time < end) if start > end else start <= local_time < end
    if not in_quiet:
        return None
    end_date = local.date() + timedelta(days=1 if start > end and local_time >= start else 0)
    return datetime.combine(end_date, end, tzinfo=zone).astimezone(UTC)


__all__ = [
    "DEFAULT_CHORE_NOTIFICATION_SETTINGS",
    "MODULE_CHORES",
    "get_user_notification_settings",
    "quiet_hours_end",
    "update_user_notification_settings",
]
