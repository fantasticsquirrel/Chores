from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_roles
from app.models.core import User
from app.models.enums import UserRole
from app.schemas.children import (
    ChildAccountResponse,
    ChildResponse,
    CreateChildAccountRequest,
    CreateChildRequest,
    UpdateChildRequest,
)
from app.security import hash_password
from app.services.children import ChildService

router = APIRouter(prefix="/children", tags=["children"])
_service = ChildService()


@router.get("", response_model=list[ChildResponse])
def list_children(
    household_id: int = Query(gt=0),
    active_only: bool = Query(default=False),
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> list[ChildResponse]:
    if household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    children = _service.list_children(session, household_id, active_only=active_only)
    return [ChildResponse.model_validate(child) for child in children]


@router.post("", response_model=ChildResponse, status_code=status.HTTP_201_CREATED)
def create_child(
    payload: CreateChildRequest,
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> ChildResponse:
    if payload.household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    try:
        child = _service.create_child(
            session,
            payload.household_id,
            payload.name,
            active=payload.active,
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid household reference.") from exc
    return ChildResponse.model_validate(child)


@router.patch("/{child_id}", response_model=ChildResponse)
def update_child(
    payload: UpdateChildRequest,
    child_id: int = Path(gt=0),
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> ChildResponse:
    if payload.household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    try:
        child = _service.update_child(
            session,
            payload.household_id,
            child_id,
            name=payload.name,
            active=payload.active,
        )
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid household reference.") from exc

    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid household reference.") from exc
    return ChildResponse.model_validate(child)


@router.post("/{child_id}/account", response_model=ChildAccountResponse, status_code=status.HTTP_201_CREATED)
def create_child_account(
    payload: CreateChildAccountRequest,
    child_id: int = Path(gt=0),
    session: Session = Depends(get_db_session),
    _user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN)),
) -> ChildAccountResponse:
    if payload.household_id != _user.household_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")

    child = _service.get_child(session, payload.household_id, child_id)
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")

    existing_for_child = session.scalar(
        select(User).where(User.household_id == payload.household_id, User.child_id == child_id, User.role == UserRole.CHILD)
    )
    if existing_for_child is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This child already has a linked login account.")

    normalized_email = payload.email.strip().lower()
    email_taken = session.scalar(
        select(User).where(User.household_id == payload.household_id, User.email == normalized_email)
    )
    if email_taken is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use in this household.")

    account = User(
        household_id=payload.household_id,
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role=UserRole.CHILD,
        child_id=child_id,
    )
    session.add(account)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create child account.") from exc

    session.refresh(account)
    return ChildAccountResponse.model_validate(account)
