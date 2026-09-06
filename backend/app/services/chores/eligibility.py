from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
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
from app.services.chores.rotation import is_child_rotation_assignee
from app.services.chores.scheduling import scheduled_occurrence_for_target


def resolve_active_child(session: Session, user: User, child_id: int | None) -> Child:
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


def eligible_chores_for_child(session: Session, child: Child, target_date: date) -> list[EligibleChoreResponse]:
    chores = list(
        session.scalars(
            select(Chore)
            .where(
                Chore.household_id == child.household_id,
                Chore.owner_user_id.is_(None),
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

        occurrence_date = scheduled_occurrence_for_target(session, chore, child, target_date)
        if occurrence_date is None:
            continue

        if chore.assignment_mode == AssignmentMode.ROTATING and not is_child_rotation_assignee(
            session, chore, child.id, occurrence_date
        ):
            continue

        if has_approved_completion_for_occurrence(session, chore, child, occurrence_date):
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


def _is_child_allowed_for_chore(session: Session, chore_id: int, child_id: int) -> bool:
    any_rows = session.scalar(select(exists().where(ChoreAllowedChild.chore_id == chore_id)))
    if not any_rows:
        return True
    return bool(
        session.scalar(
            select(exists().where(and_(ChoreAllowedChild.chore_id == chore_id, ChoreAllowedChild.child_id == child_id)))
        )
    )
def has_approved_completion_for_occurrence(session: Session, chore: Chore, child: Child, occurrence_date: date) -> bool:
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
        pending_occurrence = scheduled_occurrence_for_target(session, chore, pending_child, submission.for_date)
        if pending_occurrence == occurrence_date:
            return True

    return False



__all__ = ["eligible_chores_for_child", "has_approved_completion_for_occurrence", "resolve_active_child"]
