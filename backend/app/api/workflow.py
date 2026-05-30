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
