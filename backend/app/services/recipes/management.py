"""Actor-scoped recipe mutation orchestration without transaction ownership."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.identity import User
from app.models.recipes import (
    Recipe,
    RecipeCategoryLink,
    RecipeIngredient,
    RecipeStep,
    RecipeTagLink,
)
from app.schemas.recipes import CreateRecipeRequest, DuplicateRecipeRequest, UpdateRecipeRequest
from app.services.recipes.ownership import get_recipe_for_owner
from app.services.recipes.service import apply_recipe_payload, validate_owned_refs


def create_owned_recipe(
    session: Session,
    actor: User,
    payload: CreateRecipeRequest,
) -> Recipe:
    validate_owned_refs(session, actor, payload)
    recipe = Recipe(
        household_id=actor.household_id,
        owner_user_id=actor.id,
        title=payload.title,
    )
    session.add(recipe)
    session.flush()
    apply_recipe_payload(session, recipe, payload)
    return recipe


def create_owned_recipe_variant(
    session: Session,
    recipe_id: int,
    actor: User,
    payload: CreateRecipeRequest,
) -> Recipe:
    core = get_recipe_for_owner(session, recipe_id, actor)
    variant_payload = payload.model_copy(update={"parent_recipe_id": core.id})
    return create_owned_recipe(session, actor, variant_payload)


def update_managed_recipe(
    session: Session,
    recipe_id: int,
    actor: User,
    payload: UpdateRecipeRequest,
) -> Recipe:
    recipe = get_recipe_for_owner(session, recipe_id, actor, manage=True)
    validate_owned_refs(session, actor, payload, recipe_id=recipe.id)
    apply_recipe_payload(session, recipe, payload)
    return recipe


def set_managed_recipe_archived(
    session: Session,
    recipe_id: int,
    actor: User,
    *,
    archived: bool,
) -> Recipe:
    recipe = get_recipe_for_owner(session, recipe_id, actor, manage=True)
    recipe.archived_at = datetime.now(UTC) if archived else None
    return recipe


def delete_managed_recipe(session: Session, recipe_id: int, actor: User) -> None:
    session.delete(get_recipe_for_owner(session, recipe_id, actor, manage=True))


def duplicate_household_recipe(
    session: Session,
    recipe_id: int,
    actor: User,
    payload: DuplicateRecipeRequest,
) -> Recipe:
    source = get_recipe_for_owner(session, recipe_id, actor)
    duplicate = Recipe(
        household_id=actor.household_id,
        owner_user_id=actor.id,
        parent_recipe_id=source.id if payload.as_variant else source.parent_recipe_id,
        title=payload.title or f"{source.title} Copy",
        description=source.description,
        photo_url=source.photo_url,
        source_name=source.source_name,
        source_url=source.source_url,
        prep_minutes=source.prep_minutes,
        cook_minutes=source.cook_minutes,
        servings=source.servings,
        yield_quantity=source.yield_quantity,
        yield_unit=source.yield_unit,
        rating=source.rating,
        favorite=source.favorite,
        notes=source.notes,
    )
    session.add(duplicate)
    session.flush()
    for link in session.scalars(
        select(RecipeCategoryLink).where(RecipeCategoryLink.recipe_id == source.id)
    ):
        session.add(RecipeCategoryLink(recipe_id=duplicate.id, category_id=link.category_id))
    for link in session.scalars(
        select(RecipeTagLink).where(RecipeTagLink.recipe_id == source.id)
    ):
        session.add(RecipeTagLink(recipe_id=duplicate.id, tag_id=link.tag_id))
    for ingredient in session.scalars(
        select(RecipeIngredient).where(RecipeIngredient.recipe_id == source.id)
    ):
        session.add(
            RecipeIngredient(
                recipe_id=duplicate.id,
                position=ingredient.position,
                group_name=ingredient.group_name,
                quantity=ingredient.quantity,
                unit=ingredient.unit,
                item=ingredient.item,
                preparation=ingredient.preparation,
                note=ingredient.note,
                is_optional=ingredient.is_optional,
            )
        )
    for step in session.scalars(select(RecipeStep).where(RecipeStep.recipe_id == source.id)):
        session.add(
            RecipeStep(
                recipe_id=duplicate.id,
                position=step.position,
                section=step.section,
                instruction=step.instruction,
            )
        )
    return duplicate
