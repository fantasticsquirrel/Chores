from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.core import Household, SecurityAuditEvent, User
from app.models.enums import UserRole
from app.security.passwords import verify_password


CONFIRMATION = "TRANSFER OWNERSHIP"


def get_owned_household(session: Session, user: User) -> Household:
    household = session.get(Household, user.household_id)
    if household is None or household.owner_user_id is None:
        raise HTTPException(status_code=409, detail="Household ownership is not initialized.")
    return household


def transfer_ownership(session: Session, actor: User, target_id: int, password: str) -> Household:
    household = get_owned_household(session, actor)
    if household.owner_user_id != actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")
    if not verify_password(password, actor.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    target = session.get(User, target_id)
    if target is None or target.household_id != household.id or not target.active or target.role not in {UserRole.PARENT_ADMIN, UserRole.PARENT}:
        raise HTTPException(status_code=400, detail="New owner must be an active parent in this household.")
    old_id = household.owner_user_id
    household.owner_user_id = target.id
    session.add(SecurityAuditEvent(event_type="household.ownership_transferred", actor_user_id=actor.id, target_user_id=target.id, household_id=household.id, details_json=f'{{"previous_owner_user_id":{old_id}}}', ip_address="unknown"))
    session.flush()
    return household
