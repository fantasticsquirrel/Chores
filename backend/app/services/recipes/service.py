from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.core import (
    Recipe,
    RecipeCategoryLink,
    RecipeComponent,
    RecipeIngredient,
    RecipeStep,
    RecipeStepIngredientLink,
    RecipeTagLink,
    User,
)
from app.schemas.recipes import CreateRecipeRequest, UpdateRecipeRequest
from app.services.recipes.ownership import get_category_for_owner, get_recipe_for_owner, get_tag_for_owner


def validate_owned_refs(session: Session, user: User, payload: CreateRecipeRequest | UpdateRecipeRequest, recipe_id: int | None = None) -> None:
    if payload.parent_recipe_id is not None:
        parent = get_recipe_for_owner(session, payload.parent_recipe_id, user)
        if recipe_id is not None and parent.id == recipe_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe cannot be its own variant parent.")
    for category_id in payload.category_ids:
        get_category_for_owner(session, category_id, user)
    for tag_id in payload.tag_ids:
        get_tag_for_owner(session, tag_id, user)
    for component in payload.components:
        component_recipe = get_recipe_for_owner(session, component.component_recipe_id, user)
        if recipe_id is not None and component_recipe.id == recipe_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe cannot use itself as a component.")


def apply_recipe_payload(session: Session, recipe: Recipe, payload: CreateRecipeRequest | UpdateRecipeRequest) -> None:
    recipe.parent_recipe_id = payload.parent_recipe_id
    recipe.title = payload.title
    recipe.description = payload.description
    recipe.photo_url = str(payload.photo_url) if payload.photo_url is not None else None
    recipe.source_name = payload.source_name
    recipe.source_url = str(payload.source_url) if payload.source_url is not None else None
    recipe.prep_minutes = payload.prep_minutes
    recipe.cook_minutes = payload.cook_minutes
    recipe.servings = payload.servings
    recipe.yield_quantity = payload.yield_quantity
    recipe.yield_unit = payload.yield_unit
    recipe.rating = payload.rating
    recipe.favorite = payload.favorite
    recipe.notes = payload.notes

    if recipe.id is None:
        session.flush()

    existing_step_ids = list(session.scalars(select(RecipeStep.id).where(RecipeStep.recipe_id == recipe.id)).all())
    if existing_step_ids:
        session.execute(delete(RecipeStepIngredientLink).where(RecipeStepIngredientLink.step_id.in_(existing_step_ids)))

    session.execute(delete(RecipeCategoryLink).where(RecipeCategoryLink.recipe_id == recipe.id))
    session.execute(delete(RecipeTagLink).where(RecipeTagLink.recipe_id == recipe.id))
    session.execute(delete(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id))
    session.execute(delete(RecipeStep).where(RecipeStep.recipe_id == recipe.id))
    session.execute(delete(RecipeComponent).where(RecipeComponent.parent_recipe_id == recipe.id))

    for category_id in payload.category_ids:
        session.add(RecipeCategoryLink(recipe_id=recipe.id, category_id=category_id))
    for tag_id in payload.tag_ids:
        session.add(RecipeTagLink(recipe_id=recipe.id, tag_id=tag_id))
    ingredients_by_position: dict[int, RecipeIngredient] = {}
    steps_by_position: dict[int, RecipeStep] = {}
    for ingredient in payload.ingredients:
        ingredient_row = RecipeIngredient(recipe_id=recipe.id, **ingredient.model_dump())
        ingredients_by_position[ingredient.position] = ingredient_row
        session.add(ingredient_row)
    session.flush()
    for step in payload.steps:
        step_row = RecipeStep(recipe_id=recipe.id, **step.model_dump(exclude={"ingredient_position_refs"}))
        steps_by_position[step.position] = step_row
        session.add(step_row)
    session.flush()
    for step in payload.steps:
        step_row = steps_by_position[step.position]
        for ingredient_position in step.ingredient_position_refs:
            ingredient_row = ingredients_by_position[ingredient_position]
            session.add(RecipeStepIngredientLink(step_id=step_row.id, ingredient_id=ingredient_row.id))
    for component in payload.components:
        session.add(RecipeComponent(parent_recipe_id=recipe.id, **component.model_dump()))
