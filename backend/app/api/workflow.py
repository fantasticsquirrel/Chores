from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import Select, and_, exists, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
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
from app.modules import MODULE_CHORES
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
    CreateSubmissionRequest,
    EligibleChoreResponse,
    SubmissionItemDecisionRequest,
    SubmissionItemResponse,
    SubmissionResponse,
    SubmissionReviewItemResponse,
    SubmissionReviewResponse,
)
from app.services.chores.workflow import (
    _advance_rotation_state_if_needed,
    _approval_occurrence_or_409,
    _derive_submission_status,
    _eligible_chores_for_child,
    _resolve_active_child,
    _serialize_submission_review,
)
from app.services.notifications import notify_submission_approved, notify_submission_created

router = APIRouter(tags=["workflow"])
_REQUIRE_CHORES_ACCESS = require_module_access(MODULE_CHORES, UserRole.PARENT, UserRole.PARENT_ADMIN, UserRole.CHILD)
_REQUIRE_CHORES_PARENT = require_module_access(MODULE_CHORES, UserRole.PARENT, UserRole.PARENT_ADMIN)


@router.get("/children/me/eligible-chores", response_model=list[EligibleChoreResponse])
def list_eligible_chores(
    target_date: date = Query(alias="date"),
    child_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_ACCESS),
) -> list[EligibleChoreResponse]:
    child = _resolve_active_child(session, user, child_id)
    return _eligible_chores_for_child(session, child, target_date)


@router.post("/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def create_submission(
    payload: CreateSubmissionRequest,
    child_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_ACCESS),
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

    session.flush()
    notify_submission_created(session, submission)
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
    user: User = Depends(_REQUIRE_CHORES_PARENT),
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
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> SubmissionReviewResponse:
    submission = session.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if submission.household_id != user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    if submission.status != SubmissionStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission was already processed.")

    items = list(session.scalars(select(SubmissionItem).where(SubmissionItem.submission_id == submission_id)).all())
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Submission has no items.")

    chore_map = {
        row.id: row
        for row in session.scalars(select(Chore).where(Chore.id.in_([item.chore_id for item in items]))).all()
    }
    processed_rotation_chores: set[int] = set()

    for item in items:
        if item.status != SubmissionStatus.PENDING:
            continue

        chore = chore_map.get(item.chore_id)
        if chore is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found for submission item.")
        occurrence_date = _approval_occurrence_or_409(session, submission, chore)

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
        if chore.reward_cents != 0:
            session.add(
                Transaction(
                    household_id=submission.household_id,
                    child_id=submission.child_id,
                    amount_cents=chore.reward_cents,
                    type=TransactionType.CHORE_APPROVAL,
                )
            )

        if chore.id not in processed_rotation_chores:
            _advance_rotation_state_if_needed(session, chore, occurrence_date)
            processed_rotation_chores.add(chore.id)

    submission.status = SubmissionStatus.APPROVED
    notify_submission_approved(session, submission)
    session.commit()
    session.refresh(submission)
    return _serialize_submission_review(session, submission)


@router.post("/submissions/{submission_id}/items/{item_id}/decision", response_model=SubmissionReviewResponse)
def decide_submission_item(
    payload: SubmissionItemDecisionRequest,
    submission_id: int = Path(gt=0),
    item_id: int = Path(gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> SubmissionReviewResponse:
    submission = session.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if submission.household_id != user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    if submission.status != SubmissionStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission was already processed.")

    item = session.scalar(
        select(SubmissionItem).where(
            SubmissionItem.id == item_id,
            SubmissionItem.submission_id == submission_id,
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission item not found.")
    if item.status != SubmissionStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission item was already processed.")

    item.status = payload.status
    if payload.status == SubmissionStatus.APPROVED:
        chore = session.get(Chore, item.chore_id)
        if chore is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found for submission item.")
        occurrence_date = _approval_occurrence_or_409(session, submission, chore)
        session.add(
            CompletionRecord(
                household_id=submission.household_id,
                child_id=submission.child_id,
                chore_id=item.chore_id,
                date=submission.for_date,
                status=CompletionStatus.APPROVED,
            )
        )
        if chore.reward_cents != 0:
            session.add(
                Transaction(
                    household_id=submission.household_id,
                    child_id=submission.child_id,
                    amount_cents=chore.reward_cents,
                    type=TransactionType.CHORE_APPROVAL,
                )
            )
        _advance_rotation_state_if_needed(session, chore, occurrence_date)

    submission_items = list(
        session.scalars(
            select(SubmissionItem).where(SubmissionItem.submission_id == submission_id).order_by(SubmissionItem.id.asc())
        ).all()
    )
    submission.status = _derive_submission_status(submission_items)
    if payload.status == SubmissionStatus.APPROVED:
        notify_submission_approved(session, submission)
    session.commit()
    session.refresh(submission)
    return _serialize_submission_review(session, submission)
