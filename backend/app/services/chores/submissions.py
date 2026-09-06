"""Submission approval, reward, status, and review behavior."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Child,
    Chore,
    CompletionRecord,
    Submission,
    SubmissionItem,
    Transaction,
)
from app.models.enums import (
    AssignmentMode,
    CompletionMode,
    CompletionStatus,
    SubmissionStatus,
    TransactionType,
)
from app.schemas.workflow import (
    SubmissionReviewItemResponse,
    SubmissionReviewResponse,
)
from app.services.chores.eligibility import has_approved_completion_for_occurrence
from app.services.chores.rotation import is_child_rotation_assignee
from app.services.chores.scheduling import scheduled_occurrence_for_target


def approval_occurrence_or_409(
    session: Session,
    submission: Submission,
    chore: Chore,
) -> date:
    child = session.get(Child, submission.child_id)
    if child is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child not found for submission.",
        )

    occurrence_date = scheduled_occurrence_for_target(
        session,
        chore,
        child,
        submission.for_date,
    )
    if occurrence_date is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chore is no longer eligible for this date.",
        )

    if (
        chore.assignment_mode == AssignmentMode.ROTATING
        and not is_child_rotation_assignee(
            session,
            chore,
            child.id,
            occurrence_date,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chore is no longer assigned to this child.",
        )

    if (
        chore.timeout_days is not None
        and submission.for_date
        > occurrence_date + timedelta(days=chore.timeout_days)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Submission window has closed.",
        )

    if has_approved_completion_for_occurrence(
        session,
        chore,
        child,
        occurrence_date,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chore already has an approved completion.",
        )

    return occurrence_date


def _occurrence_key(
    submission: Submission,
    chore: Chore,
    occurrence_date: date,
) -> str:
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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chore occurrence was already approved.",
        ) from exc

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


def serialize_submission_review(
    session: Session,
    submission: Submission,
) -> SubmissionReviewResponse:
    child = session.get(Child, submission.child_id)
    if child is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child not found for submission.",
        )

    chore_lookup = {
        chore.id: chore
        for chore in session.scalars(
            select(Chore)
            .join(SubmissionItem, SubmissionItem.chore_id == Chore.id)
            .where(SubmissionItem.submission_id == submission.id)
        ).all()
    }
    items = list(
        session.scalars(
            select(SubmissionItem).where(
                SubmissionItem.submission_id == submission.id,
            )
        ).all()
    )

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


def derive_submission_status(items: list[SubmissionItem]) -> SubmissionStatus:
    if any(item.status == SubmissionStatus.PENDING for item in items):
        return SubmissionStatus.PENDING
    if any(item.status == SubmissionStatus.APPROVED for item in items):
        return SubmissionStatus.APPROVED
    return SubmissionStatus.REJECTED

__all__ = [
    "approval_occurrence_or_409",
    "derive_submission_status",
    "record_approved_occurrence",
    "serialize_submission_review",
]
