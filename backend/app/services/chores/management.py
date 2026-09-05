"""Household-scoped chore CRUD, assignment, and schedule validation."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.chores import (
    Chore,
    ChoreAllowedChild,
    ChoreRotationMember,
    ChoreRotationState,
)
from app.models.enums import AssignmentMode, ScheduleMode, UserRole
from app.models.identity import Child, User
from app.schemas.chores import CreateChoreRequest, UpdateChoreRequest


def get_household_chore_or_404(session: Session, chore_id: int, household_id: int) -> Chore:
    """Load a protected chore without revealing cross-household records."""
    chore = session.scalar(
        select(Chore).where(Chore.id == chore_id, Chore.household_id == household_id)
    )
    if chore is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found.")
    return chore


def list_household_chores(
    session: Session,
    household_id: int,
    *,
    active_only: bool,
) -> list[Chore]:
    stmt = select(Chore).where(Chore.household_id == household_id)
    if active_only:
        stmt = stmt.where(Chore.archived_at.is_(None))
    return list(session.scalars(stmt).all())


def create_household_chore(
    session: Session,
    payload: CreateChoreRequest,
    *,
    actor: User,
) -> Chore:
    if payload.assignment_mode == AssignmentMode.ROTATING:
        _validate_child_ids(session, payload.rotation_order, payload.household_id)
    else:
        _validate_child_ids(session, payload.allowed_child_ids, payload.household_id)

    chore = Chore(
        household_id=payload.household_id,
        owner_user_id=payload.owner_user_id,
        name=payload.name,
        reward_cents=payload.reward_cents,
        start_date=payload.start_date,
        expires_at=payload.expires_at,
        timeout_days=payload.timeout_days,
        schedule_mode=payload.schedule_mode,
        schedule_interval=payload.schedule_interval,
        schedule_unit=payload.schedule_unit,
        completion_mode=payload.completion_mode,
        assignment_mode=payload.assignment_mode,
    )
    session.add(chore)
    session.flush()

    if payload.owner_user_id is not None:
        _validate_parent_owner(session, payload.owner_user_id, actor)
    elif payload.assignment_mode == AssignmentMode.ROTATING:
        _sync_rotation_members(session, chore.id, payload.rotation_order)
        _sync_allowed_children(session, chore.id, payload.rotation_order)
    else:
        _sync_allowed_children(session, chore.id, payload.allowed_child_ids)

    return chore


def update_household_chore(
    session: Session,
    chore_id: int,
    payload: UpdateChoreRequest,
    *,
    actor: User,
) -> Chore:
    chore = get_household_chore_or_404(session, chore_id, payload.household_id)
    fields = payload.model_fields_set

    if "owner_user_id" in fields:
        if payload.owner_user_id is not None:
            _validate_parent_owner(session, payload.owner_user_id, actor)
        chore.owner_user_id = payload.owner_user_id
    if "name" in fields:
        chore.name = _required_update_value(payload.name, "name")
    if "reward_cents" in fields:
        chore.reward_cents = _required_update_value(payload.reward_cents, "reward_cents")
    if "start_date" in fields:
        chore.start_date = _required_update_value(payload.start_date, "start_date")
    if "expires_at" in fields:
        chore.expires_at = payload.expires_at
    if "timeout_days" in fields:
        chore.timeout_days = payload.timeout_days
    if "schedule_mode" in fields:
        chore.schedule_mode = _required_update_value(payload.schedule_mode, "schedule_mode")
    if "schedule_interval" in fields:
        chore.schedule_interval = payload.schedule_interval
    if "schedule_unit" in fields:
        chore.schedule_unit = payload.schedule_unit
    if "completion_mode" in fields:
        chore.completion_mode = _required_update_value(payload.completion_mode, "completion_mode")
    if "assignment_mode" in fields:
        chore.assignment_mode = _required_update_value(payload.assignment_mode, "assignment_mode")

    if chore.owner_user_id is not None:
        if chore.reward_cents != 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Parent-owned chores cannot have a financial reward.",
            )
        chore.assignment_mode = AssignmentMode.STATIC
        _sync_allowed_children(session, chore.id, [])
        _sync_rotation_members(session, chore.id, [])
    else:
        _sync_effective_assignment(session, chore, payload)
    _validate_effective_schedule(chore, payload)

    return chore


def archive_household_chore(session: Session, chore_id: int, household_id: int) -> Chore:
    chore = get_household_chore_or_404(session, chore_id, household_id)
    if chore.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chore is already archived.")
    chore.archived_at = datetime.now(timezone.utc)
    return chore


def _validate_child_ids(session: Session, child_ids: list[int], household_id: int) -> None:
    if not child_ids:
        return
    children = list(
        session.scalars(
            select(Child).where(Child.id.in_(child_ids), Child.household_id == household_id)
        ).all()
    )
    found_ids = {child.id for child in children}
    missing = set(child_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Child IDs not found in this household: {sorted(missing)}",
        )


def _sync_allowed_children(session: Session, chore_id: int, child_ids: list[int]) -> None:
    session.execute(delete(ChoreAllowedChild).where(ChoreAllowedChild.chore_id == chore_id))
    for child_id in child_ids:
        session.add(ChoreAllowedChild(chore_id=chore_id, child_id=child_id))


def _sync_rotation_members(session: Session, chore_id: int, ordered_child_ids: list[int]) -> None:
    session.execute(delete(ChoreRotationMember).where(ChoreRotationMember.chore_id == chore_id))
    session.execute(delete(ChoreRotationState).where(ChoreRotationState.chore_id == chore_id))
    for position, child_id in enumerate(ordered_child_ids):
        session.add(ChoreRotationMember(chore_id=chore_id, child_id=child_id, position=position))


def _load_eligibility(session: Session, chore_id: int) -> tuple[list[int], list[int]]:
    allowed = list(
        session.scalars(
            select(ChoreAllowedChild.child_id).where(ChoreAllowedChild.chore_id == chore_id)
        ).all()
    )
    rotation = list(
        session.scalars(
            select(ChoreRotationMember.child_id)
            .where(ChoreRotationMember.chore_id == chore_id)
            .order_by(ChoreRotationMember.position.asc())
        ).all()
    )
    return allowed, rotation


def _validate_parent_owner(session: Session, owner_user_id: int, actor: User) -> None:
    owner = session.scalar(
        select(User).where(
            User.id == owner_user_id,
            User.household_id == actor.household_id,
            User.role.in_((UserRole.PARENT, UserRole.PARENT_ADMIN)),
            User.active.is_(True),
        )
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Active parent owner not found in this household.",
        )
    if actor.role != UserRole.PARENT_ADMIN and owner_user_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parents can only manage their own personal chores.",
        )


def _required_update_value(value, field_name: str):
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} cannot be null.",
        )
    return value


def _validate_effective_schedule(chore: Chore, payload: UpdateChoreRequest) -> None:
    recurring_modes = {ScheduleMode.EVERY, ScheduleMode.AFTER_COMPLETION}
    if chore.schedule_mode in recurring_modes:
        if chore.schedule_interval is None or chore.schedule_unit is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="schedule_interval and schedule_unit are required for recurring schedules.",
            )
        return

    if payload.schedule_interval is not None or payload.schedule_unit is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="schedule_interval and schedule_unit must be null unless the schedule is recurring.",
        )

    chore.schedule_interval = None
    chore.schedule_unit = None


def _sync_effective_assignment(session: Session, chore: Chore, payload: UpdateChoreRequest) -> None:
    fields = payload.model_fields_set
    if chore.assignment_mode == AssignmentMode.ROTATING:
        if "allowed_child_ids" in fields and payload.allowed_child_ids is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Use rotation_order to choose children for rotating chores.",
            )

        if "rotation_order" in fields:
            rotation_order = payload.rotation_order or []
            if len(rotation_order) < 2:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="rotation_order must contain at least 2 children when assignment_mode is ROTATING.",
                )
            _validate_child_ids(session, rotation_order, chore.household_id)
            _sync_rotation_members(session, chore.id, rotation_order)
            _sync_allowed_children(session, chore.id, rotation_order)
            return

        existing_allowed, existing_rotation = _load_eligibility(session, chore.id)
        if len(existing_rotation) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="rotation_order must contain at least 2 children when assignment_mode is ROTATING.",
            )
        if existing_allowed != existing_rotation:
            _sync_allowed_children(session, chore.id, existing_rotation)
        return

    if "rotation_order" in fields and payload.rotation_order is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rotation_order can only be set when assignment_mode is ROTATING.",
        )

    session.execute(delete(ChoreRotationMember).where(ChoreRotationMember.chore_id == chore.id))
    session.execute(delete(ChoreRotationState).where(ChoreRotationState.chore_id == chore.id))

    if "allowed_child_ids" in fields and payload.allowed_child_ids is not None:
        _validate_child_ids(session, payload.allowed_child_ids, chore.household_id)
        _sync_allowed_children(session, chore.id, payload.allowed_child_ids)


__all__ = [
    "archive_household_chore",
    "create_household_chore",
    "get_household_chore_or_404",
    "list_household_chores",
    "update_household_chore",
]
