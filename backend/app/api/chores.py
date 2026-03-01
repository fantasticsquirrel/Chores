from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_roles
from app.models.core import Chore, User
from app.models.enums import UserRole
from app.schemas.chores import ChoreResponse, CreateChoreRequest, UpdateChoreRequest

router = APIRouter(prefix="/chores", tags=["chores"])


def _get_chore_or_404(session: Session, chore_id: int, household_id: int) -> Chore:
    chore = session.get(Chore, chore_id)
    if chore is None or chore.household_id != household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore not found.")
    return chore


@router.get("", response_model=list[ChoreResponse])
def list_chores(
    household_id: int = Query(gt=0),
    active_only: bool = Query(default=True),
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> list[ChoreResponse]:
    if household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    stmt = select(Chore).where(Chore.household_id == household_id)
    if active_only:
        stmt = stmt.where(Chore.archived_at.is_(None))
    chores = list(session.scalars(stmt).all())
    return [ChoreResponse.model_validate(c) for c in chores]


@router.post("", response_model=ChoreResponse, status_code=status.HTTP_201_CREATED)
def create_chore(
    payload: CreateChoreRequest,
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> ChoreResponse:
    if payload.household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    chore = Chore(
        household_id=payload.household_id,
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
    session.commit()
    session.refresh(chore)
    return ChoreResponse.model_validate(chore)


@router.patch("/{chore_id}", response_model=ChoreResponse)
def update_chore(
    payload: UpdateChoreRequest,
    chore_id: int = Path(gt=0),
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> ChoreResponse:
    if payload.household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    chore = _get_chore_or_404(session, chore_id, payload.household_id)
    if payload.name is not None:
        chore.name = payload.name
    if payload.reward_cents is not None:
        chore.reward_cents = payload.reward_cents
    if payload.start_date is not None:
        chore.start_date = payload.start_date
    if payload.expires_at is not None:
        chore.expires_at = payload.expires_at
    if payload.timeout_days is not None:
        chore.timeout_days = payload.timeout_days
    if payload.schedule_mode is not None:
        chore.schedule_mode = payload.schedule_mode
    if payload.schedule_interval is not None:
        chore.schedule_interval = payload.schedule_interval
    if payload.schedule_unit is not None:
        chore.schedule_unit = payload.schedule_unit
    if payload.completion_mode is not None:
        chore.completion_mode = payload.completion_mode
    if payload.assignment_mode is not None:
        chore.assignment_mode = payload.assignment_mode
    session.commit()
    session.refresh(chore)
    return ChoreResponse.model_validate(chore)


@router.delete("/{chore_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_chore(
    chore_id: int = Path(gt=0),
    household_id: int = Query(gt=0),
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> None:
    if household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    chore = _get_chore_or_404(session, chore_id, household_id)
    if chore.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chore is already archived.")
    chore.archived_at = datetime.now(timezone.utc)
    session.commit()
