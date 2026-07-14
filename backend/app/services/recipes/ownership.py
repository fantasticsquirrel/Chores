from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.core import Recipe, RecipeCategory, RecipeTag, User
from app.models.enums import UserRole


def get_category_for_owner(session: Session, category_id: int, user: User) -> RecipeCategory:
    category = session.get(RecipeCategory, category_id)
    if category is None or category.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe category not found.")
    return category


def get_tag_for_owner(session: Session, tag_id: int, user: User) -> RecipeTag:
    tag = session.get(RecipeTag, tag_id)
    if tag is None or tag.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe tag not found.")
    return tag


def get_recipe_for_owner(
    session: Session,
    recipe_id: int,
    user: User,
    *,
    manage: bool = False,
) -> Recipe:
    recipe = session.get(Recipe, recipe_id)
    if recipe is None or recipe.household_id != user.household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found.")
    if manage and recipe.owner_user_id != user.id and user.role != UserRole.PARENT_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the recipe creator or a household admin can edit this recipe.")
    return recipe
