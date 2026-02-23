from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import Select, and_, exists, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_roles
from app.models.core import (
    Child,
    Chore,
    ChoreAllowedChild,
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
    SubmissionStatus,
    TransactionType,
    UserRole,
)
from app.schemas.workflow import (
    CreateSubmissionRequest,
    EligibleChoreResponse,
    SubmissionItemResponse,
    SubmissionResponse,
    SubmissionReviewItemResponse,
    SubmissionReviewResponse,
)

router = APIRouter(tags=["workflow"])


@router.get("/children/me/eligible-chores", response_model=list[EligibleChoreResponse])
def list_eligible_chores(
    target_date: date = Query(alias="date"),
    child_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN, UserRole.CHILD)),
) -> list[EligibleChoreResponse]:
    child = _resolve_active_child(session, user, child_id)
    return _eligible_chores_for_child(session, child, target_date)


@router.post("/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def create_submission(
    payload: CreateSubmissionRequest,
    child_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN, UserRole.CHILD)),
) -> SubmissionResponse:
    child = _resolve_active_child(session, user, child_id)
    eligible = _eligible_chores_for_child(session, child, payload.for_date)
    eligible_chore_ids = {item.chore_id for item in eligible}

    invalid_chore_ids = [chore_id for chore_id in payload.chore_ids if chore_id not in eligible_chore_ids]
    if invalid_chore_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chores are not eligible for submission: {invalid_chore_ids}",
        )

    submission = Submission(
        household_id=child.household_id,
        child_id=child.id,
        for_date=payload.for_date,
        status=SubmissionStatus.PENDING,
    )
    session.add(submission)
    session.flush()

    items: list[SubmissionItemResponse] = []
    for chore_id in payload.chore_ids:
        session.add(
            SubmissionItem(
                submission_id=submission.id,
                chore_id=chore_id,
                status=SubmissionStatus.PENDING,
            )
        )
        items.append(SubmissionItemResponse(chore_id=chore_id, status=SubmissionStatus.PENDING))

    session.commit()
    return SubmissionResponse(
        id=submission.id,
        child_id=submission.child_id,
        for_date=submission.for_date,
        status=submission.status,
        items=items,
    )


@router.get("/submissions", response_model=list[SubmissionReviewResponse])
def list_submissions(
    status_filter: SubmissionStatus | None = Query(default=None, alias="status"),
    session: Session = Depends(get_db_session),
    user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> list[SubmissionReviewResponse]:
    query: Select[tuple[Submission]] = (
        select(Submission)
        .where(Submission.household_id == user.household_id)
        .order_by(Submission.id.asc())
    )
    if status_filter is not None:
        query = query.where(Submission.status == status_filter)

    submissions = list(session.scalars(query).all())
    return [_serialize_submission_review(session, submission) for submission in submissions]


@router.post("/submissions/{submission_id}/approve-all", response_model=SubmissionReviewResponse)
def approve_submission(
    submission_id: int = Path(gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> SubmissionReviewResponse:
    submission = session.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if submission.household_id != user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")

    items = list(session.scalars(select(SubmissionItem).where(SubmissionItem.submission_id == submission_id)).all())
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Submission has no items.")

    reward_map = {
        row.id: row.reward_cents
        for row in session.scalars(select(Chore).where(Chore.id.in_([item.chore_id for item in items]))).all()
    }

    for item in items:
        if item.status != SubmissionStatus.PENDING:
            continue

        item.status = SubmissionStatus.APPROVED
        session.add(
            CompletionRecord(
                household_id=submission.household_id,
                child_id=submission.child_id,
                chore_id=item.chore_id,
                date=submission.for_date,
                status=CompletionStatus.APPROVED,
            )
        )
        session.add(
            Transaction(
                household_id=submission.household_id,
                child_id=submission.child_id,
                amount_cents=reward_map.get(item.chore_id, 0),
                type=TransactionType.CHORE_APPROVAL,
            )
        )

    submission.status = SubmissionStatus.APPROVED
    session.commit()
    session.refresh(submission)
    return _serialize_submission_review(session, submission)


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
    has_allowed_rows = exists(select(1).where(ChoreAllowedChild.chore_id == Chore.id))
    explicitly_allowed = exists(
        select(1).where(
            and_(
                ChoreAllowedChild.chore_id == Chore.id,
                ChoreAllowedChild.child_id == child.id,
            )
        )
    )
    child_has_completion = exists(
        select(1).where(
            and_(
                CompletionRecord.child_id == child.id,
                CompletionRecord.chore_id == Chore.id,
                CompletionRecord.date == target_date,
                CompletionRecord.status == CompletionStatus.APPROVED,
            )
        )
    )
    any_child_has_completion = exists(
        select(1).where(
            and_(
                CompletionRecord.household_id == child.household_id,
                CompletionRecord.chore_id == Chore.id,
                CompletionRecord.date == target_date,
                CompletionRecord.status == CompletionStatus.APPROVED,
            )
        )
    )

    query = (
        select(Chore)
        .where(
            Chore.household_id == child.household_id,
            Chore.archived_at.is_(None),
            Chore.schedule_mode == ScheduleMode.NONE,
            Chore.assignment_mode == AssignmentMode.STATIC,
            Chore.start_date <= target_date,
            or_(Chore.expires_at.is_(None), Chore.expires_at >= target_date),
            or_(~has_allowed_rows, explicitly_allowed),
            or_(
                and_(Chore.completion_mode == CompletionMode.PER_CHILD, ~child_has_completion),
                and_(Chore.completion_mode == CompletionMode.SHARED, ~any_child_has_completion),
            ),
        )
        .order_by(Chore.id.asc())
    )

    chores = list(session.scalars(query).all())
    results: list[EligibleChoreResponse] = []

    for chore in chores:
        expires_on: date | None = None
        if chore.timeout_days is not None:
            expires_on = chore.start_date + timedelta(days=chore.timeout_days)
            if target_date > expires_on:
                continue

        results.append(
            EligibleChoreResponse(
                chore_id=chore.id,
                name=chore.name,
                reward_cents=chore.reward_cents,
                occurrence_date=chore.start_date,
                expires_on=expires_on,
            )
        )

    return results


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
