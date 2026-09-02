"""Chore occurrence scheduling calculations."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import Child, Chore, CompletionRecord
from app.models.enums import CompletionMode, CompletionStatus, ScheduleMode, ScheduleUnit


def _schedule_unit_days(unit: ScheduleUnit | None) -> int:
    if unit == ScheduleUnit.WEEK:
        return 7
    if unit == ScheduleUnit.MONTH:
        return 30
    return 1


def _latest_completion_date_for_scope(session: Session, chore: Chore, child: Child) -> date | None:
    query = select(CompletionRecord.date).where(
        CompletionRecord.chore_id == chore.id,
        CompletionRecord.status == CompletionStatus.APPROVED,
    )
    if chore.completion_mode == CompletionMode.PER_CHILD:
        query = query.where(CompletionRecord.child_id == child.id)
    else:
        query = query.where(CompletionRecord.household_id == child.household_id)
    return session.scalar(query.order_by(CompletionRecord.date.desc()).limit(1))


def scheduled_occurrence_for_target(session: Session, chore: Chore, child: Child, target_date: date) -> date | None:
    if target_date < chore.start_date:
        return None
    if chore.schedule_mode == ScheduleMode.NONE:
        return target_date
    if chore.schedule_mode == ScheduleMode.ONCE:
        return chore.start_date if target_date == chore.start_date else None
    if chore.schedule_mode == ScheduleMode.EVERY:
        if chore.schedule_interval is None:
            return None
        step_days = chore.schedule_interval * _schedule_unit_days(chore.schedule_unit)
        delta_days = (target_date - chore.start_date).days
        return target_date if delta_days >= 0 and delta_days % step_days == 0 else None
    if chore.schedule_mode == ScheduleMode.AFTER_COMPLETION:
        step_days = (chore.schedule_interval or 1) * _schedule_unit_days(chore.schedule_unit)
        latest_completion = _latest_completion_date_for_scope(session, chore, child)
        due_date = chore.start_date if latest_completion is None else latest_completion + timedelta(days=step_days)
        return due_date if target_date >= due_date else None
    return None


__all__ = ["scheduled_occurrence_for_target"]
