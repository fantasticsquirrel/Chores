"""Personal parent-chore scheduling and completion behavior."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chores import Chore, ParentChoreCompletion
from app.models.enums import ScheduleMode, ScheduleUnit
from app.models.identity import User
from app.services.chores.management import get_household_chore_or_404


def list_due_parent_chores(session: Session, actor: User, target_date: date) -> list[Chore]:
    chores = list(
        session.scalars(
            select(Chore)
            .where(
                Chore.household_id == actor.household_id,
                Chore.owner_user_id == actor.id,
                Chore.archived_at.is_(None),
            )
            .order_by(Chore.id.asc())
        ).all()
    )
    return [chore for chore in chores if _parent_task_due(session, chore, actor.id, target_date)]


def complete_parent_chore(
    session: Session,
    chore_id: int,
    target_date: date,
    *,
    actor: User,
) -> ParentChoreCompletion:
    chore = get_household_chore_or_404(session, chore_id, actor.household_id)
    if chore.owner_user_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This personal chore belongs to another parent.",
        )
    if not _parent_task_due(session, chore, actor.id, target_date):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This personal chore is not due.")

    completion = ParentChoreCompletion(
        household_id=actor.household_id,
        chore_id=chore.id,
        user_id=actor.id,
        date=target_date,
    )
    session.add(completion)
    return completion


def _parent_task_due(session: Session, chore: Chore, user_id: int, target_date: date) -> bool:
    if target_date < chore.start_date or (
        chore.expires_at is not None and target_date > chore.expires_at
    ):
        return False
    completed_today = session.scalar(
        select(ParentChoreCompletion.id).where(
            ParentChoreCompletion.chore_id == chore.id,
            ParentChoreCompletion.user_id == user_id,
            ParentChoreCompletion.date == target_date,
        )
    )
    if completed_today is not None:
        return False
    if chore.schedule_mode == ScheduleMode.ONCE:
        return target_date == chore.start_date
    if chore.schedule_mode == ScheduleMode.NONE:
        return True
    multiplier = (
        1
        if chore.schedule_unit == ScheduleUnit.DAY
        else 7
        if chore.schedule_unit == ScheduleUnit.WEEK
        else 30
    )
    interval_days = (chore.schedule_interval or 1) * multiplier
    if chore.schedule_mode == ScheduleMode.EVERY:
        return (target_date - chore.start_date).days % interval_days == 0
    latest = session.scalar(
        select(ParentChoreCompletion.date)
        .where(
            ParentChoreCompletion.chore_id == chore.id,
            ParentChoreCompletion.user_id == user_id,
        )
        .order_by(ParentChoreCompletion.date.desc())
    )
    return latest is None or target_date >= latest + timedelta(days=interval_days)


__all__ = ["complete_parent_chore", "list_due_parent_chores"]
