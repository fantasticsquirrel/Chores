"""Chore reminder generation and household-local scheduling."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
import math
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Child, Household, User
from app.models.enums import UserRole
from app.services.chores.eligibility import eligible_chores_for_child
from app.services.notification_creation import create_notification
from app.services.notification_preferences import MODULE_CHORES, get_user_notification_settings


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _timezone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def generate_daily_chore_reminders(
    target_date: date,
) -> int:
    from app.config import get_settings
    from app.db import get_session_factory

    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        created = _generate_daily(
            session,
            target_date,
        )
        session.commit()
        return created


def _generate_daily(
    session: Session,
    target_date: date,
    *,
    only_user_id: int | None = None,
) -> int:
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
        eligible = eligible_chores_for_child(session, child, target_date)
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


def run_notification_scheduler(
    *,
    now: datetime | None = None,
) -> dict[str, int]:
    from app.config import get_settings
    from app.db import get_session_factory

    current = now or _utc_now()
    factory = get_session_factory(get_settings().database_url)
    counts: dict[str, int] = {}
    with factory() as session:
        child_users = list(
            session.scalars(select(User).where(User.role == UserRole.CHILD, User.child_id.is_not(None))).all()
        )
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
                    eligible = eligible_chores_for_child(session, child, target)
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
                    made = _generate_daily(
                        session,
                        local.date(),
                        only_user_id=user.id,
                    )
                    counts["daily_digest"] = counts.get("daily_digest", 0) + made
        session.commit()
    return {key: value for key, value in counts.items() if value}


__all__ = ["generate_daily_chore_reminders", "run_notification_scheduler"]
