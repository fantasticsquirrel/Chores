"""Rotation assignment and state transitions for chores."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Chore, ChoreRotationMember, ChoreRotationState
from app.models.enums import AssignmentMode, ScheduleMode, ScheduleUnit


def _schedule_unit_days(unit: ScheduleUnit | None) -> int:
    if unit == ScheduleUnit.WEEK:
        return 7
    if unit == ScheduleUnit.MONTH:
        return 30
    return 1


def is_child_rotation_assignee(session: Session, chore: Chore, child_id: int, occurrence_date: date) -> bool:
    members = list(
        session.scalars(
            select(ChoreRotationMember)
            .where(ChoreRotationMember.chore_id == chore.id)
            .order_by(ChoreRotationMember.position.asc())
        ).all()
    )
    if not members:
        return False

    step_days = max(1, (chore.schedule_interval or 1) * _schedule_unit_days(chore.schedule_unit))
    if chore.schedule_mode == ScheduleMode.EVERY:
        index = ((occurrence_date - chore.start_date).days // step_days) % len(members)
    elif chore.schedule_mode == ScheduleMode.ONCE:
        index = 0
    else:
        state = session.get(ChoreRotationState, chore.id)
        index = (state.current_position if state is not None else 0) % len(members)

    return members[index].child_id == child_id


def advance_rotation_state_if_needed(session: Session, chore: Chore, occurrence_date: date) -> None:
    if chore.assignment_mode != AssignmentMode.ROTATING:
        return

    members = list(
        session.scalars(
            select(ChoreRotationMember)
            .where(ChoreRotationMember.chore_id == chore.id)
            .order_by(ChoreRotationMember.position.asc())
        ).all()
    )
    if len(members) <= 1:
        return

    state = session.get(ChoreRotationState, chore.id)
    if state is None:
        state = ChoreRotationState(chore_id=chore.id, current_position=0, last_occurrence_date=None)
        session.add(state)

    if state.last_occurrence_date == occurrence_date:
        return

    state.current_position = (state.current_position + 1) % len(members)
    state.last_occurrence_date = occurrence_date


__all__ = ["advance_rotation_state_if_needed", "is_child_rotation_assignee"]
