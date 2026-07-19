from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_roles
from app.models.core import User
from app.models.enums import UserRole
from app.schemas.ownership import OwnershipResponse, OwnershipTransferRequest
from app.services.ownership import get_owned_household, transfer_ownership

router = APIRouter(prefix="/households/me/ownership", tags=["household-ownership"])
PARENTS = (UserRole.PARENT_ADMIN, UserRole.PARENT)


@router.get("", response_model=OwnershipResponse)
def read_ownership(session: Session = Depends(get_db_session), user: User = Depends(require_roles(*PARENTS))) -> OwnershipResponse:
    household = get_owned_household(session, user)
    owner = session.get(User, household.owner_user_id)
    return OwnershipResponse(
        household_id=household.id,
        owner_user_id=household.owner_user_id,  # type: ignore[arg-type]
        owner_email=owner.email,  # type: ignore[union-attr]
    )


@router.post("/transfer", response_model=OwnershipResponse)
def transfer(payload: OwnershipTransferRequest, request: Request, session: Session = Depends(get_db_session), user: User = Depends(require_roles(*PARENTS))) -> OwnershipResponse:
    _ = request
    household = transfer_ownership(session, user, payload.new_owner_user_id, payload.current_password)
    session.commit()
    owner = session.get(User, household.owner_user_id)
    return OwnershipResponse(
        household_id=household.id,
        owner_user_id=household.owner_user_id,  # type: ignore[arg-type]
        owner_email=owner.email,  # type: ignore[union-attr]
    )
