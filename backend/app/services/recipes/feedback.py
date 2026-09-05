from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.models.identity import Child, User
from app.models.recipes import RecipeFeedback
from app.schemas.recipes import UpsertRecipeFeedbackRequest
from app.services.recipes.ownership import get_recipe_for_owner


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


def upsert_household_recipe_feedback(
    session: Session,
    recipe_id: int,
    actor: User,
    payload: UpsertRecipeFeedbackRequest,
) -> RecipeFeedback:
    recipe = get_recipe_for_owner(session, recipe_id, actor)
    reviewer_key, parent_user_id, child_id = feedback_reviewer(payload, actor, session)
    feedback = session.scalar(
        select(RecipeFeedback).where(
            RecipeFeedback.recipe_id == recipe.id,
            RecipeFeedback.reviewer_type == payload.reviewer_type,
            RecipeFeedback.reviewer_key == reviewer_key,
        )
    )
    if feedback is None:
        feedback = RecipeFeedback(
            recipe_id=recipe.id,
            household_id=actor.household_id,
            reviewer_type=payload.reviewer_type,
            reviewer_key=reviewer_key,
            parent_user_id=parent_user_id,
            child_id=child_id,
        )
        session.add(feedback)
    feedback.rating = payload.rating
    feedback.verdict = payload.verdict
    feedback.notes = payload.notes
    return feedback
