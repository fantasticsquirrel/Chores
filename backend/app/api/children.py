from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.schemas.children import ChildResponse, CreateChildRequest, UpdateChildRequest
from app.services.children import ChildService

router = APIRouter(prefix="/children", tags=["children"])
_service = ChildService()


@router.get("", response_model=list[ChildResponse])
def list_children(
    household_id: int = Query(gt=0),
    active_only: bool = Query(default=False),
    session: Session = Depends(get_db_session),
) -> list[ChildResponse]:
    children = _service.list_children(session, household_id, active_only=active_only)
    return [ChildResponse.model_validate(child) for child in children]


@router.post("", response_model=ChildResponse, status_code=status.HTTP_201_CREATED)
def create_child(payload: CreateChildRequest, session: Session = Depends(get_db_session)) -> ChildResponse:
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
) -> ChildResponse:
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
