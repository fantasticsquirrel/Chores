from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    child = _service.create_child(
        session,
        payload.household_id,
        payload.name,
        active=payload.active,
    )
    session.commit()
    return ChildResponse.model_validate(child)


@router.patch("/{child_id}", response_model=ChildResponse)
def update_child(
    child_id: int,
    payload: UpdateChildRequest,
    session: Session = Depends(get_db_session),
) -> ChildResponse:
    child = _service.update_child(
        session,
        payload.household_id,
        child_id,
        name=payload.name,
        active=payload.active,
    )

    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")

    session.commit()
    return ChildResponse.model_validate(child)
