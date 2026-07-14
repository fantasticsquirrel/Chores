from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.core import (
    Child,
    Chore,
    ChoreAllowedChild,
    ChoreRotationMember,
    ChoreRotationState,
    CompletionRecord,
    Submission,
    SubmissionItem,
    Transaction,
    User,
)
from app.models.enums import (
    AssignmentMode,
    CompletionMode,
    CompletionStatus,
    ScheduleMode,
    ScheduleUnit,
    SubmissionStatus,
    TransactionType,
    UserRole,
)
from app.schemas.workflow import (
    EligibleChoreResponse,
    SubmissionReviewItemResponse,
    SubmissionReviewResponse,
)


def _resolve_active_child(session: Session, user: User, child_id: int | None) -> Child:
    if user.role == UserRole.CHILD:
        if user.child_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
        if child_id is not None and child_id != user.child_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
        child_id = user.child_id

    if child_id is not None:
        child = session.get(Child, child_id)
        if child is None or not child.active or child.household_id != user.household_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active child not found.")
        return child

    child = session.scalars(
        select(Child).where(Child.household_id == user.household_id, Child.active.is_(True)).order_by(Child.id.asc())
    ).first()
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active child not found.")
    return child


def _eligible_chores_for_child(session: Session, child: Child, target_date: date) -> list[EligibleChoreResponse]:
    chores = list(
        session.scalars(
            select(Chore)
            .where(
                Chore.household_id == child.household_id,
                Chore.archived_at.is_(None),
                Chore.start_date <= target_date,
                or_(Chore.expires_at.is_(None), Chore.expires_at >= target_date),
            )
            .order_by(Chore.id.asc())
        ).all()
    )

    results: list[EligibleChoreResponse] = []

    for chore in chores:
        if not _is_child_allowed_for_chore(session, chore.id, child.id):
            continue

        occurrence_date = _scheduled_occurrence_for_target(session, chore, child, target_date)
        if occurrence_date is None:
            continue

        if chore.assignment_mode == AssignmentMode.ROTATING and not _is_child_rotation_assignee(
            session, chore, child.id, occurrence_date
        ):
            continue

        if _has_approved_completion_for_occurrence(session, chore, child, occurrence_date):
            continue

        if _has_pending_submission_for_occurrence(session, chore, child, occurrence_date):
            continue

        expires_on: date | None = None
        if chore.timeout_days is not None:
            expires_on = occurrence_date + timedelta(days=chore.timeout_days)
            if target_date > expires_on:
                continue

        results.append(
            EligibleChoreResponse(
                chore_id=chore.id,
                name=chore.name,
                reward_cents=chore.reward_cents,
                occurrence_date=occurrence_date,
                expires_on=expires_on,
            )
        )

    return results


def _schedule_unit_days(unit: ScheduleUnit | None) -> int:
    if unit == ScheduleUnit.WEEK:
        return 7
    if unit == ScheduleUnit.MONTH:
        return 30
    return 1


def _is_child_allowed_for_chore(session: Session, chore_id: int, child_id: int) -> bool:
    any_rows = session.scalar(select(exists().where(ChoreAllowedChild.chore_id == chore_id)))
    if not any_rows:
        return True
    return bool(
        session.scalar(
            select(exists().where(and_(ChoreAllowedChild.chore_id == chore_id, ChoreAllowedChild.child_id == child_id)))
        )
    )


def _latest_completion_date_for_scope(session: Session, chore: Chore, child: Child) -> date | None:
    query = select(CompletionRecord.date).where(
        CompletionRecord.chore_id == chore.id,
        CompletionRecord.status == CompletionStatus.APPROVED,
    )
    if chore.completion_mode == CompletionMode.PER_CHILD:
        query = query.where(CompletionRecord.child_id == child.id)
    else:
        query = query.where(CompletionRecord.household_id == child.household_id)
    query = query.order_by(CompletionRecord.date.desc()).limit(1)
    return session.scalar(query)


def _scheduled_occurrence_for_target(session: Session, chore: Chore, child: Child, target_date: date) -> date | None:
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
        if delta_days < 0 or delta_days % step_days != 0:
            return None
        return target_date

    if chore.schedule_mode == ScheduleMode.AFTER_COMPLETION:
        interval = chore.schedule_interval or 1
        step_days = interval * _schedule_unit_days(chore.schedule_unit)
        latest_completion = _latest_completion_date_for_scope(session, chore, child)
        due_date = chore.start_date if latest_completion is None else latest_completion + timedelta(days=step_days)
        if target_date < due_date:
            return None
        return due_date

    return None


def _has_approved_completion_for_occurrence(session: Session, chore: Chore, child: Child, occurrence_date: date) -> bool:
    query = select(exists().where(
        and_(
            CompletionRecord.chore_id == chore.id,
            CompletionRecord.date == occurrence_date,
            CompletionRecord.status == CompletionStatus.APPROVED,
        )
    ))
    if chore.completion_mode == CompletionMode.PER_CHILD:
        query = select(exists().where(
            and_(
                CompletionRecord.chore_id == chore.id,
                CompletionRecord.date == occurrence_date,
                CompletionRecord.status == CompletionStatus.APPROVED,
                CompletionRecord.child_id == child.id,
            )
        ))
    else:
        query = select(exists().where(
            and_(
                CompletionRecord.chore_id == chore.id,
                CompletionRecord.date == occurrence_date,
                CompletionRecord.status == CompletionStatus.APPROVED,
                CompletionRecord.household_id == child.household_id,
            )
        ))
    return bool(session.scalar(query))


def _has_pending_submission_for_occurrence(session: Session, chore: Chore, child: Child, occurrence_date: date) -> bool:
    query = (
        select(Submission)
        .join(SubmissionItem, SubmissionItem.submission_id == Submission.id)
        .where(
            Submission.household_id == child.household_id,
            Submission.status == SubmissionStatus.PENDING,
            SubmissionItem.chore_id == chore.id,
            SubmissionItem.status == SubmissionStatus.PENDING,
        )
    )
    if chore.completion_mode == CompletionMode.PER_CHILD:
        query = query.where(Submission.child_id == child.id)

    pending_submissions = list(session.scalars(query).all())
    for submission in pending_submissions:
        pending_child = child if submission.child_id == child.id else session.get(Child, submission.child_id)
        if pending_child is None:
            continue
        pending_occurrence = _scheduled_occurrence_for_target(session, chore, pending_child, submission.for_date)
        if pending_occurrence == occurrence_date:
            return True

    return False


def _approval_occurrence_or_409(session: Session, submission: Submission, chore: Chore) -> date:
    child = session.get(Child, submission.child_id)
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found for submission.")

    occurrence_date = _scheduled_occurrence_for_target(session, chore, child, submission.for_date)
    if occurrence_date is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chore is no longer eligible for this date.")

    if chore.assignment_mode == AssignmentMode.ROTATING and not _is_child_rotation_assignee(
        session, chore, child.id, occurrence_date
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chore is no longer assigned to this child.")

    if chore.timeout_days is not None and submission.for_date > occurrence_date + timedelta(days=chore.timeout_days):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission window has closed.")

    if _has_approved_completion_for_occurrence(session, chore, child, occurrence_date):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chore already has an approved completion.")

    return occurrence_date


def _occurrence_key(submission: Submission, chore: Chore, occurrence_date: date) -> str:
    if chore.completion_mode == CompletionMode.SHARED:
        scope = f"household:{submission.household_id}"
    else:
        scope = f"child:{submission.child_id}"
    return f"{scope}:chore:{chore.id}:date:{occurrence_date.isoformat()}"


def record_approved_occurrence(
    session: Session,
    *,
    submission: Submission,
    chore: Chore,
    occurrence_date: date,
) -> CompletionRecord:
    """Atomically establish the canonical occurrence and any linked reward."""
    completion = CompletionRecord(
        household_id=submission.household_id,
        child_id=submission.child_id,
        chore_id=chore.id,
        occurrence_key=_occurrence_key(submission, chore, occurrence_date),
        date=occurrence_date,
        status=CompletionStatus.APPROVED,
    )
    session.add(completion)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chore occurrence was already approved.") from exc

    if chore.reward_cents != 0:
        session.add(
            Transaction(
                household_id=submission.household_id,
                child_id=submission.child_id,
                completion_record_id=completion.id,
                amount_cents=chore.reward_cents,
                type=TransactionType.CHORE_APPROVAL,
            )
        )
    return completion


def _is_child_rotation_assignee(session: Session, chore: Chore, child_id: int, occurrence_date: date) -> bool:
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
        idx = ((occurrence_date - chore.start_date).days // step_days) % len(members)
    elif chore.schedule_mode == ScheduleMode.ONCE:
        idx = 0
    else:
        state = session.get(ChoreRotationState, chore.id)
        idx = (state.current_position if state is not None else 0) % len(members)

    return members[idx].child_id == child_id


def _advance_rotation_state_if_needed(session: Session, chore: Chore, occurrence_date: date) -> None:
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


def _serialize_submission_review(session: Session, submission: Submission) -> SubmissionReviewResponse:
    child = session.get(Child, submission.child_id)
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found for submission.")

    chore_lookup = {
        chore.id: chore
        for chore in session.scalars(
            select(Chore)
            .join(SubmissionItem, SubmissionItem.chore_id == Chore.id)
            .where(SubmissionItem.submission_id == submission.id)
        ).all()
    }
    items = list(session.scalars(select(SubmissionItem).where(SubmissionItem.submission_id == submission.id)).all())

    return SubmissionReviewResponse(
        id=submission.id,
        child_id=submission.child_id,
        child_name=child.name,
        for_date=submission.for_date,
        status=submission.status,
        items=[
            SubmissionReviewItemResponse(
                id=item.id,
                chore_id=item.chore_id,
                chore_name=chore_lookup[item.chore_id].name,
                chore_reward_cents=chore_lookup[item.chore_id].reward_cents,
                status=item.status,
            )
            for item in items
        ],
    )


def _derive_submission_status(items: list[SubmissionItem]) -> SubmissionStatus:
    if any(item.status == SubmissionStatus.PENDING for item in items):
        return SubmissionStatus.PENDING
    if any(item.status == SubmissionStatus.APPROVED for item in items):
        return SubmissionStatus.APPROVED
    return SubmissionStatus.REJECTED
