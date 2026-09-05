from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
from app.models.enums import UserRole
from app.models.identity import User
from app.modules import MODULE_CHORES
from app.schemas.chores import ChoreResponse, CreateChoreRequest, UpdateChoreRequest
from app.services.chores.management import (
    archive_household_chore,
    create_household_chore,
    list_household_chores,
    update_household_chore,
)
from app.services.chores.parent_tasks import complete_parent_chore, list_due_parent_chores
from app.services.chores.serialization import serialize_chore

router = APIRouter(prefix="/chores", tags=["chores"])
_REQUIRE_CHORES_PARENT = require_module_access(MODULE_CHORES, UserRole.PARENT, UserRole.PARENT_ADMIN)


def _require_household_scope(requested_household_id: int, actor: User) -> None:
    if requested_household_id != actor.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")


@router.get("", response_model=list[ChoreResponse])
def list_chores(
    household_id: int = Query(gt=0),
    active_only: bool = Query(default=True),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> list[ChoreResponse]:
    _require_household_scope(household_id, user)
    chores = list_household_chores(session, household_id, active_only=active_only)
    return [serialize_chore(session, chore) for chore in chores]


@router.post("", response_model=ChoreResponse, status_code=status.HTTP_201_CREATED)
def create_chore(
    payload: CreateChoreRequest,
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> ChoreResponse:
    _require_household_scope(payload.household_id, user)
    chore = create_household_chore(session, payload, actor=user)
    session.commit()
    session.refresh(chore)
    return serialize_chore(session, chore)


@router.patch("/{chore_id}", response_model=ChoreResponse)
def update_chore(
    payload: UpdateChoreRequest,
    chore_id: int = Path(gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> ChoreResponse:
    _require_household_scope(payload.household_id, user)
    chore = update_household_chore(session, chore_id, payload, actor=user)
    session.commit()
    session.refresh(chore)
    return serialize_chore(session, chore)


@router.delete("/{chore_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_chore(
    chore_id: int = Path(gt=0),
    household_id: int = Query(gt=0),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> None:
    _require_household_scope(household_id, user)
    archive_household_chore(session, chore_id, household_id)
    session.commit()


@router.get("/me/today", response_model=list[ChoreResponse])
def list_my_parent_tasks(
    target_date: date = Query(alias="date"),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> list[ChoreResponse]:
    chores = list_due_parent_chores(session, user, target_date)
    return [serialize_chore(session, chore) for chore in chores]


@router.post("/{chore_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
def complete_parent_task(
    chore_id: int = Path(gt=0),
    target_date: date = Query(alias="date"),
    session: Session = Depends(get_db_session),
    user: User = Depends(_REQUIRE_CHORES_PARENT),
) -> None:
    complete_parent_chore(session, chore_id, target_date, actor=user)
    session.commit()
