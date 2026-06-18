from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import (
    Child,
    Recipe,
    RecipeCategory,
    RecipeCategoryLink,
    RecipeComponent,
    RecipeFeedback,
    RecipeIngredient,
    RecipeStep,
    RecipeStepIngredientLink,
    RecipeTag,
    RecipeTagLink,
    User,
)


def category_dict(category: RecipeCategory) -> dict[str, object]:
    return {
        "id": category.id,
        "household_id": category.household_id,
        "owner_user_id": category.owner_user_id,
        "name": category.name,
        "color": category.color,
    }


def tag_dict(tag: RecipeTag) -> dict[str, object]:
    return {
        "id": tag.id,
        "household_id": tag.household_id,
        "owner_user_id": tag.owner_user_id,
        "name": tag.name,
    }


def recipe_base_dict(recipe: Recipe) -> dict[str, object]:
    return {
        "id": recipe.id,
        "household_id": recipe.household_id,
        "owner_user_id": recipe.owner_user_id,
        "parent_recipe_id": recipe.parent_recipe_id,
        "title": recipe.title,
        "description": recipe.description,
        "photo_url": recipe.photo_url,
        "source_name": recipe.source_name,
        "source_url": recipe.source_url,
        "prep_minutes": recipe.prep_minutes,
        "cook_minutes": recipe.cook_minutes,
        "servings": recipe.servings,
        "yield_quantity": recipe.yield_quantity,
        "yield_unit": recipe.yield_unit,
        "rating": recipe.rating,
        "favorite": recipe.favorite,
        "notes": recipe.notes,
        "archived_at": recipe.archived_at,
    }


def recipe_categories(session: Session, recipe_id: int) -> list[RecipeCategory]:
    return list(
        session.scalars(
            select(RecipeCategory)
            .join(RecipeCategoryLink, RecipeCategoryLink.category_id == RecipeCategory.id)
            .where(RecipeCategoryLink.recipe_id == recipe_id)
            .order_by(RecipeCategory.name)
        )
    )


def recipe_tags(session: Session, recipe_id: int) -> list[RecipeTag]:
    return list(
        session.scalars(
            select(RecipeTag)
            .join(RecipeTagLink, RecipeTagLink.tag_id == RecipeTag.id)
            .where(RecipeTagLink.recipe_id == recipe_id)
            .order_by(RecipeTag.name)
        )
    )


def ingredient_dict(ingredient: RecipeIngredient) -> dict[str, object]:
    return {
        "id": ingredient.id,
        "recipe_id": ingredient.recipe_id,
        "position": ingredient.position,
        "group_name": ingredient.group_name,
        "quantity": ingredient.quantity,
        "unit": ingredient.unit,
        "item": ingredient.item,
        "preparation": ingredient.preparation,
        "note": ingredient.note,
        "is_optional": ingredient.is_optional,
    }


def step_ingredient_ids(session: Session, step_id: int) -> list[int]:
    return list(
        session.scalars(
            select(RecipeIngredient.id)
            .join(RecipeStepIngredientLink, RecipeStepIngredientLink.ingredient_id == RecipeIngredient.id)
            .where(RecipeStepIngredientLink.step_id == step_id)
            .order_by(RecipeIngredient.position)
        )
    )


def step_dict(session: Session, step: RecipeStep) -> dict[str, object]:
    return {
        "id": step.id,
        "recipe_id": step.recipe_id,
        "position": step.position,
        "section": step.section,
        "instruction": step.instruction,
        "ingredient_position_refs": [],
        "ingredient_ids": step_ingredient_ids(session, step.id),
    }


def reviewer_name(session: Session, feedback: RecipeFeedback) -> str:
    if feedback.reviewer_type == "PARENT" and feedback.parent_user_id is not None:
        parent = session.get(User, feedback.parent_user_id)
        return parent.email if parent is not None else "Parent"
    if feedback.child_id is not None:
        child = session.get(Child, feedback.child_id)
        return child.name if child is not None else "Child"
    return "Family member"


def feedback_dict(session: Session, feedback: RecipeFeedback) -> dict[str, object]:
    return {
        "id": feedback.id,
        "recipe_id": feedback.recipe_id,
        "household_id": feedback.household_id,
        "reviewer_type": feedback.reviewer_type,
        "parent_user_id": feedback.parent_user_id,
        "child_id": feedback.child_id,
        "reviewer_name": reviewer_name(session, feedback),
        "rating": feedback.rating,
        "verdict": feedback.verdict,
        "notes": feedback.notes,
        "created_at": feedback.created_at,
    }


def feedback_summary(session: Session, recipe_id: int) -> dict[str, object]:
    ratings = [
        rating
        for rating in session.scalars(select(RecipeFeedback.rating).where(RecipeFeedback.recipe_id == recipe_id, RecipeFeedback.rating.is_not(None))).all()
        if rating is not None
    ]
    if not ratings:
        return {"average_rating": None, "rating_count": 0}
    return {"average_rating": round(sum(ratings) / len(ratings), 2), "rating_count": len(ratings)}


def recipe_feedback(session: Session, recipe_id: int) -> list[RecipeFeedback]:
    return list(
        session.scalars(
            select(RecipeFeedback)
            .where(RecipeFeedback.recipe_id == recipe_id)
            .order_by(RecipeFeedback.reviewer_type.desc(), RecipeFeedback.reviewer_key)
        )
    )


def summary_dict(session: Session, recipe: Recipe) -> dict[str, object]:
    data = recipe_base_dict(recipe)
    data["categories"] = [category_dict(category) for category in recipe_categories(session, recipe.id)]
    data["tags"] = [tag_dict(tag) for tag in recipe_tags(session, recipe.id)]
    data["ingredient_count"] = session.scalar(select(RecipeIngredient.id).where(RecipeIngredient.recipe_id == recipe.id).limit(1)) is not None and len(
        session.scalars(select(RecipeIngredient.id).where(RecipeIngredient.recipe_id == recipe.id)).all()
    ) or 0
    data["feedback_summary"] = feedback_summary(session, recipe.id)
    return data


def detail_dict(session: Session, recipe: Recipe) -> dict[str, object]:
    data = summary_dict(session, recipe)
    data["ingredients"] = [
        ingredient_dict(ingredient)
        for ingredient in session.scalars(select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id).order_by(RecipeIngredient.position)).all()
    ]
    data["steps"] = [
        step_dict(session, step)
        for step in session.scalars(select(RecipeStep).where(RecipeStep.recipe_id == recipe.id).order_by(RecipeStep.position)).all()
    ]
    components = session.scalars(select(RecipeComponent).where(RecipeComponent.parent_recipe_id == recipe.id).order_by(RecipeComponent.label)).all()
    data["components"] = [
        {
            "component_recipe_id": component.component_recipe_id,
            "label": component.label,
            "quantity": component.quantity,
            "unit": component.unit,
            "component_recipe": summary_dict(session, session.get(Recipe, component.component_recipe_id)),
        }
        for component in components
        if session.get(Recipe, component.component_recipe_id) is not None
    ]
    variants = session.scalars(
        select(Recipe)
        .where(Recipe.owner_user_id == recipe.owner_user_id, Recipe.parent_recipe_id == recipe.id)
        .order_by(Recipe.title)
    ).all()
    data["variants"] = [summary_dict(session, variant) for variant in variants]
    data["core_recipe"] = summary_dict(session, session.get(Recipe, recipe.parent_recipe_id)) if recipe.parent_recipe_id is not None and session.get(Recipe, recipe.parent_recipe_id) is not None else None
    data["feedback"] = [feedback_dict(session, row) for row in recipe_feedback(session, recipe.id)]
    return data
