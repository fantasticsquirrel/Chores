from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.core import Child, User
from app.models.enums import UserRole
from app.schemas.recipes import UpsertRecipeFeedbackRequest


def feedback_reviewer(payload: UpsertRecipeFeedbackRequest, current_user: User, session: Session) -> tuple[str, int | None, int | None]:
    if payload.reviewer_type == "PARENT":
        parent = session.get(User, payload.parent_user_id)
        if parent is None or parent.household_id != current_user.household_id or parent.role not in {UserRole.PARENT_ADMIN, UserRole.PARENT}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe feedback parent reviewer not found.")
        return f"parent:{parent.id}", parent.id, None
    child = session.get(Child, payload.child_id)
    if child is None or child.household_id != current_user.household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe feedback child reviewer not found.")
    return f"child:{child.id}", None, child.id
