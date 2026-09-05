"""Actor-scoped recipe catalog, category, and tag operations."""

from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.identity import User
from app.models.recipes import (
    Recipe,
    RecipeCategory,
    RecipeCategoryLink,
    RecipeIngredient,
    RecipeStep,
    RecipeTag,
    RecipeTagLink,
)
from app.schemas.recipes import (
    CreateRecipeCategoryRequest,
    CreateRecipeTagRequest,
    UpdateRecipeCategoryRequest,
    UpdateRecipeTagRequest,
)
from app.services.recipes.ownership import get_category_for_owner, get_tag_for_owner


def list_owned_categories(session: Session, actor: User) -> list[RecipeCategory]:
    return list(
        session.scalars(
            select(RecipeCategory)
            .where(RecipeCategory.owner_user_id == actor.id)
            .order_by(RecipeCategory.name)
        )
    )


def create_owned_category(
    session: Session,
    actor: User,
    payload: CreateRecipeCategoryRequest,
) -> RecipeCategory:
    category = RecipeCategory(
        household_id=actor.household_id,
        owner_user_id=actor.id,
        **payload.model_dump(),
    )
    session.add(category)
    return category


def update_owned_category(
    session: Session,
    category_id: int,
    actor: User,
    payload: UpdateRecipeCategoryRequest,
) -> RecipeCategory:
    category = get_category_for_owner(session, category_id, actor)
    category.name = payload.name
    category.color = payload.color
    return category


def delete_owned_category(session: Session, category_id: int, actor: User) -> None:
    session.delete(get_category_for_owner(session, category_id, actor))


def list_owned_tags(session: Session, actor: User) -> list[RecipeTag]:
    return list(
        session.scalars(
            select(RecipeTag)
            .where(RecipeTag.owner_user_id == actor.id)
            .order_by(RecipeTag.name)
        )
    )


def create_owned_tag(
    session: Session,
    actor: User,
    payload: CreateRecipeTagRequest,
) -> RecipeTag:
    tag = RecipeTag(
        household_id=actor.household_id,
        owner_user_id=actor.id,
        **payload.model_dump(),
    )
    session.add(tag)
    return tag


def update_owned_tag(
    session: Session,
    tag_id: int,
    actor: User,
    payload: UpdateRecipeTagRequest,
) -> RecipeTag:
    tag = get_tag_for_owner(session, tag_id, actor)
    tag.name = payload.name
    return tag


def delete_owned_tag(session: Session, tag_id: int, actor: User) -> None:
    session.delete(get_tag_for_owner(session, tag_id, actor))


def list_household_recipes(
    session: Session,
    actor: User,
    *,
    query: str | None = None,
    category_id: int | None = None,
    tag_id: int | None = None,
    favorite: bool | None = None,
    min_rating: int | None = None,
    ingredient: str | None = None,
    active_only: bool = True,
) -> list[Recipe]:
    stmt = select(Recipe).where(Recipe.household_id == actor.household_id)
    if active_only:
        stmt = stmt.where(Recipe.archived_at.is_(None))
    if favorite is not None:
        stmt = stmt.where(Recipe.favorite.is_(favorite))
    if min_rating is not None:
        stmt = stmt.where(Recipe.rating >= min_rating)
    if category_id is not None:
        stmt = stmt.join(RecipeCategoryLink, RecipeCategoryLink.recipe_id == Recipe.id).where(
            RecipeCategoryLink.category_id == category_id
        )
    if tag_id is not None:
        stmt = stmt.join(RecipeTagLink, RecipeTagLink.recipe_id == Recipe.id).where(
            RecipeTagLink.tag_id == tag_id
        )
    if ingredient:
        pattern = f"%{ingredient.strip()}%"
        stmt = stmt.where(
            select(RecipeIngredient.id)
            .where(
                RecipeIngredient.recipe_id == Recipe.id,
                RecipeIngredient.item.ilike(pattern),
            )
            .exists()
        )
    if query:
        pattern = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Recipe.title.ilike(pattern),
                Recipe.description.ilike(pattern),
                Recipe.source_name.ilike(pattern),
                Recipe.notes.ilike(pattern),
                select(RecipeStep.id)
                .where(
                    RecipeStep.recipe_id == Recipe.id,
                    RecipeStep.instruction.ilike(pattern),
                )
                .exists(),
            )
        )
    return list(session.scalars(stmt.order_by(Recipe.title)).unique())
