from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
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
from app.models.enums import UserRole
from app.modules import MODULE_RECIPES
from app.schemas.recipes import (
    ArchiveRecipeRequest,
    CreateRecipeCategoryRequest,
    CreateRecipeRequest,
    CreateRecipeTagRequest,
    DuplicateRecipeRequest,
    RecipeCategoryResponse,
    RecipeDetailResponse,
    RecipeScaleResponse,
    RecipeSummaryResponse,
    RecipeTagResponse,
    UpdateRecipeCategoryRequest,
    UpdateRecipeRequest,
    UpdateRecipeTagRequest,
    UpsertRecipeFeedbackRequest,
)
from app.services.recipes import scale_ingredients, scale_linked_steps

router = APIRouter(prefix="/recipes", tags=["recipes"])
_require_recipes_access = require_module_access(MODULE_RECIPES, UserRole.PARENT_ADMIN, UserRole.PARENT)


def _get_category(session: Session, category_id: int, user: User) -> RecipeCategory:
    category = session.get(RecipeCategory, category_id)
    if category is None or category.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe category not found.")
    return category


def _get_tag(session: Session, tag_id: int, user: User) -> RecipeTag:
    tag = session.get(RecipeTag, tag_id)
    if tag is None or tag.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe tag not found.")
    return tag


def _get_recipe(session: Session, recipe_id: int, user: User) -> Recipe:
    recipe = session.get(Recipe, recipe_id)
    if recipe is None or recipe.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found.")
    return recipe


def _category_dict(category: RecipeCategory) -> dict[str, object]:
    return {
        "id": category.id,
        "household_id": category.household_id,
        "owner_user_id": category.owner_user_id,
        "name": category.name,
        "color": category.color,
    }


def _tag_dict(tag: RecipeTag) -> dict[str, object]:
    return {
        "id": tag.id,
        "household_id": tag.household_id,
        "owner_user_id": tag.owner_user_id,
        "name": tag.name,
    }


def _recipe_base_dict(recipe: Recipe) -> dict[str, object]:
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


def _recipe_categories(session: Session, recipe_id: int) -> list[RecipeCategory]:
    return list(
        session.scalars(
            select(RecipeCategory)
            .join(RecipeCategoryLink, RecipeCategoryLink.category_id == RecipeCategory.id)
            .where(RecipeCategoryLink.recipe_id == recipe_id)
            .order_by(RecipeCategory.name)
        )
    )


def _recipe_tags(session: Session, recipe_id: int) -> list[RecipeTag]:
    return list(
        session.scalars(
            select(RecipeTag)
            .join(RecipeTagLink, RecipeTagLink.tag_id == RecipeTag.id)
            .where(RecipeTagLink.recipe_id == recipe_id)
            .order_by(RecipeTag.name)
        )
    )


def _ingredient_dict(ingredient: RecipeIngredient) -> dict[str, object]:
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


def _step_ingredient_ids(session: Session, step_id: int) -> list[int]:
    return list(
        session.scalars(
            select(RecipeIngredient.id)
            .join(RecipeStepIngredientLink, RecipeStepIngredientLink.ingredient_id == RecipeIngredient.id)
            .where(RecipeStepIngredientLink.step_id == step_id)
            .order_by(RecipeIngredient.position)
        )
    )


def _step_dict(session: Session, step: RecipeStep) -> dict[str, object]:
    return {
        "id": step.id,
        "recipe_id": step.recipe_id,
        "position": step.position,
        "section": step.section,
        "instruction": step.instruction,
        "ingredient_position_refs": [],
        "ingredient_ids": _step_ingredient_ids(session, step.id),
    }


def _reviewer_name(session: Session, feedback: RecipeFeedback) -> str:
    if feedback.reviewer_type == "PARENT" and feedback.parent_user_id is not None:
        parent = session.get(User, feedback.parent_user_id)
        return parent.email if parent is not None else "Parent"
    if feedback.child_id is not None:
        child = session.get(Child, feedback.child_id)
        return child.name if child is not None else "Child"
    return "Family member"


def _feedback_dict(session: Session, feedback: RecipeFeedback) -> dict[str, object]:
    return {
        "id": feedback.id,
        "recipe_id": feedback.recipe_id,
        "household_id": feedback.household_id,
        "reviewer_type": feedback.reviewer_type,
        "parent_user_id": feedback.parent_user_id,
        "child_id": feedback.child_id,
        "reviewer_name": _reviewer_name(session, feedback),
        "rating": feedback.rating,
        "verdict": feedback.verdict,
        "notes": feedback.notes,
        "created_at": feedback.created_at,
    }


def _feedback_summary(session: Session, recipe_id: int) -> dict[str, object]:
    ratings = [
        rating
        for rating in session.scalars(select(RecipeFeedback.rating).where(RecipeFeedback.recipe_id == recipe_id, RecipeFeedback.rating.is_not(None))).all()
        if rating is not None
    ]
    if not ratings:
        return {"average_rating": None, "rating_count": 0}
    return {"average_rating": round(sum(ratings) / len(ratings), 2), "rating_count": len(ratings)}


def _recipe_feedback(session: Session, recipe_id: int) -> list[RecipeFeedback]:
    return list(
        session.scalars(
            select(RecipeFeedback)
            .where(RecipeFeedback.recipe_id == recipe_id)
            .order_by(RecipeFeedback.reviewer_type.desc(), RecipeFeedback.reviewer_key)
        )
    )


def _summary_dict(session: Session, recipe: Recipe) -> dict[str, object]:
    data = _recipe_base_dict(recipe)
    data["categories"] = [_category_dict(category) for category in _recipe_categories(session, recipe.id)]
    data["tags"] = [_tag_dict(tag) for tag in _recipe_tags(session, recipe.id)]
    data["ingredient_count"] = session.scalar(select(RecipeIngredient.id).where(RecipeIngredient.recipe_id == recipe.id).limit(1)) is not None and len(
        session.scalars(select(RecipeIngredient.id).where(RecipeIngredient.recipe_id == recipe.id)).all()
    ) or 0
    data["feedback_summary"] = _feedback_summary(session, recipe.id)
    return data


def _detail_dict(session: Session, recipe: Recipe) -> dict[str, object]:
    data = _summary_dict(session, recipe)
    data["ingredients"] = [
        _ingredient_dict(ingredient)
        for ingredient in session.scalars(select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id).order_by(RecipeIngredient.position)).all()
    ]
    data["steps"] = [
        _step_dict(session, step)
        for step in session.scalars(select(RecipeStep).where(RecipeStep.recipe_id == recipe.id).order_by(RecipeStep.position)).all()
    ]
    components = session.scalars(select(RecipeComponent).where(RecipeComponent.parent_recipe_id == recipe.id).order_by(RecipeComponent.label)).all()
    data["components"] = [
        {
            "component_recipe_id": component.component_recipe_id,
            "label": component.label,
            "quantity": component.quantity,
            "unit": component.unit,
            "component_recipe": _summary_dict(session, session.get(Recipe, component.component_recipe_id)),
        }
        for component in components
        if session.get(Recipe, component.component_recipe_id) is not None
    ]
    variants = session.scalars(
        select(Recipe)
        .where(Recipe.owner_user_id == recipe.owner_user_id, Recipe.parent_recipe_id == recipe.id)
        .order_by(Recipe.title)
    ).all()
    data["variants"] = [_summary_dict(session, variant) for variant in variants]
    data["core_recipe"] = _summary_dict(session, session.get(Recipe, recipe.parent_recipe_id)) if recipe.parent_recipe_id is not None and session.get(Recipe, recipe.parent_recipe_id) is not None else None
    data["feedback"] = [_feedback_dict(session, row) for row in _recipe_feedback(session, recipe.id)]
    return data


def _validate_owned_refs(session: Session, user: User, payload: CreateRecipeRequest | UpdateRecipeRequest, recipe_id: int | None = None) -> None:
    if payload.parent_recipe_id is not None:
        parent = _get_recipe(session, payload.parent_recipe_id, user)
        if recipe_id is not None and parent.id == recipe_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe cannot be its own variant parent.")
    for category_id in payload.category_ids:
        _get_category(session, category_id, user)
    for tag_id in payload.tag_ids:
        _get_tag(session, tag_id, user)
    for component in payload.components:
        component_recipe = _get_recipe(session, component.component_recipe_id, user)
        if recipe_id is not None and component_recipe.id == recipe_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe cannot use itself as a component.")


def _apply_recipe_payload(session: Session, recipe: Recipe, payload: CreateRecipeRequest | UpdateRecipeRequest) -> None:
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


@router.get("/categories", response_model=list[RecipeCategoryResponse])
def list_categories(current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> list[dict[str, object]]:
    categories = session.scalars(select(RecipeCategory).where(RecipeCategory.owner_user_id == current_user.id).order_by(RecipeCategory.name)).all()
    return [_category_dict(category) for category in categories]


@router.post("/categories", response_model=RecipeCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(payload: CreateRecipeCategoryRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    category = RecipeCategory(household_id=current_user.household_id, owner_user_id=current_user.id, **payload.model_dump())
    session.add(category)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe category already exists.") from exc
    session.refresh(category)
    return _category_dict(category)


@router.put("/categories/{category_id}", response_model=RecipeCategoryResponse)
def update_category(category_id: int, payload: UpdateRecipeCategoryRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    category = _get_category(session, category_id, current_user)
    category.name = payload.name
    category.color = payload.color
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe category already exists.") from exc
    session.refresh(category)
    return _category_dict(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> None:
    category = _get_category(session, category_id, current_user)
    session.delete(category)
    session.commit()


@router.get("/tags", response_model=list[RecipeTagResponse])
def list_tags(current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> list[dict[str, object]]:
    tags = session.scalars(select(RecipeTag).where(RecipeTag.owner_user_id == current_user.id).order_by(RecipeTag.name)).all()
    return [_tag_dict(tag) for tag in tags]


@router.post("/tags", response_model=RecipeTagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(payload: CreateRecipeTagRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    tag = RecipeTag(household_id=current_user.household_id, owner_user_id=current_user.id, **payload.model_dump())
    session.add(tag)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe tag already exists.") from exc
    session.refresh(tag)
    return _tag_dict(tag)


@router.put("/tags/{tag_id}", response_model=RecipeTagResponse)
def update_tag(tag_id: int, payload: UpdateRecipeTagRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    tag = _get_tag(session, tag_id, current_user)
    tag.name = payload.name
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe tag already exists.") from exc
    session.refresh(tag)
    return _tag_dict(tag)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> None:
    tag = _get_tag(session, tag_id, current_user)
    session.delete(tag)
    session.commit()


@router.get("", response_model=list[RecipeSummaryResponse])
def list_recipes(
    query: str | None = None,
    category_id: int | None = Query(default=None, gt=0),
    tag_id: int | None = Query(default=None, gt=0),
    favorite: bool | None = None,
    min_rating: int | None = Query(default=None, ge=1, le=5),
    ingredient: str | None = None,
    active_only: bool = True,
    current_user: User = Depends(_require_recipes_access),
    session: Session = Depends(get_db_session),
) -> list[dict[str, object]]:
    stmt = select(Recipe).where(Recipe.owner_user_id == current_user.id)
    if active_only:
        stmt = stmt.where(Recipe.archived_at.is_(None))
    if favorite is not None:
        stmt = stmt.where(Recipe.favorite.is_(favorite))
    if min_rating is not None:
        stmt = stmt.where(Recipe.rating >= min_rating)
    if category_id is not None:
        stmt = stmt.join(RecipeCategoryLink, RecipeCategoryLink.recipe_id == Recipe.id).where(RecipeCategoryLink.category_id == category_id)
    if tag_id is not None:
        stmt = stmt.join(RecipeTagLink, RecipeTagLink.recipe_id == Recipe.id).where(RecipeTagLink.tag_id == tag_id)
    if ingredient:
        pattern = f"%{ingredient.strip()}%"
        stmt = stmt.where(select(RecipeIngredient.id).where(RecipeIngredient.recipe_id == Recipe.id, RecipeIngredient.item.ilike(pattern)).exists())
    if query:
        pattern = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Recipe.title.ilike(pattern),
                Recipe.description.ilike(pattern),
                Recipe.source_name.ilike(pattern),
                Recipe.notes.ilike(pattern),
                select(RecipeStep.id).where(RecipeStep.recipe_id == Recipe.id, RecipeStep.instruction.ilike(pattern)).exists(),
            )
        )
    recipes = session.scalars(stmt.order_by(Recipe.title)).unique().all()
    return [_summary_dict(session, recipe) for recipe in recipes]


@router.post("", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: CreateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    _validate_owned_refs(session, current_user, payload)
    recipe = Recipe(household_id=current_user.household_id, owner_user_id=current_user.id, title=payload.title)
    session.add(recipe)
    session.flush()
    _apply_recipe_payload(session, recipe, payload)
    session.commit()
    session.refresh(recipe)
    return _detail_dict(session, recipe)


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
def get_recipe(recipe_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    return _detail_dict(session, _get_recipe(session, recipe_id, current_user))


@router.post("/{recipe_id}/variants", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_recipe_variant(recipe_id: int, payload: CreateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    core = _get_recipe(session, recipe_id, current_user)
    variant_payload = payload.model_copy(update={"parent_recipe_id": core.id})
    _validate_owned_refs(session, current_user, variant_payload)
    variant = Recipe(household_id=current_user.household_id, owner_user_id=current_user.id, title=variant_payload.title)
    session.add(variant)
    session.flush()
    _apply_recipe_payload(session, variant, variant_payload)
    session.commit()
    session.refresh(variant)
    return _detail_dict(session, variant)


def _feedback_reviewer(payload: UpsertRecipeFeedbackRequest, current_user: User, session: Session) -> tuple[str, int | None, int | None]:
    if payload.reviewer_type == "PARENT":
        parent = session.get(User, payload.parent_user_id)
        if parent is None or parent.household_id != current_user.household_id or parent.role not in {UserRole.PARENT_ADMIN, UserRole.PARENT}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe feedback parent reviewer not found.")
        return f"parent:{parent.id}", parent.id, None
    child = session.get(Child, payload.child_id)
    if child is None or child.household_id != current_user.household_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe feedback child reviewer not found.")
    return f"child:{child.id}", None, child.id


@router.put("/{recipe_id}/feedback", response_model=dict)
def upsert_recipe_feedback(recipe_id: int, payload: UpsertRecipeFeedbackRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = _get_recipe(session, recipe_id, current_user)
    reviewer_key, parent_user_id, child_id = _feedback_reviewer(payload, current_user, session)
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
            household_id=current_user.household_id,
            reviewer_type=payload.reviewer_type,
            reviewer_key=reviewer_key,
            parent_user_id=parent_user_id,
            child_id=child_id,
        )
        session.add(feedback)
    feedback.rating = payload.rating
    feedback.verdict = payload.verdict
    feedback.notes = payload.notes
    session.commit()
    session.refresh(feedback)
    return _feedback_dict(session, feedback)


@router.put("/{recipe_id}", response_model=RecipeDetailResponse)
def update_recipe(recipe_id: int, payload: UpdateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = _get_recipe(session, recipe_id, current_user)
    _validate_owned_refs(session, current_user, payload, recipe_id=recipe.id)
    _apply_recipe_payload(session, recipe, payload)
    session.commit()
    session.refresh(recipe)
    return _detail_dict(session, recipe)


@router.patch("/{recipe_id}/archive", response_model=RecipeDetailResponse)
def archive_recipe(recipe_id: int, payload: ArchiveRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = _get_recipe(session, recipe_id, current_user)
    recipe.archived_at = datetime.now(UTC) if payload.archived else None
    session.commit()
    session.refresh(recipe)
    return _detail_dict(session, recipe)


@router.post("/{recipe_id}/duplicate", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def duplicate_recipe(recipe_id: int, payload: DuplicateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    source = _get_recipe(session, recipe_id, current_user)
    duplicate = Recipe(
        household_id=current_user.household_id,
        owner_user_id=current_user.id,
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
    for link in session.scalars(select(RecipeCategoryLink).where(RecipeCategoryLink.recipe_id == source.id)).all():
        session.add(RecipeCategoryLink(recipe_id=duplicate.id, category_id=link.category_id))
    for link in session.scalars(select(RecipeTagLink).where(RecipeTagLink.recipe_id == source.id)).all():
        session.add(RecipeTagLink(recipe_id=duplicate.id, tag_id=link.tag_id))
    for ingredient in session.scalars(select(RecipeIngredient).where(RecipeIngredient.recipe_id == source.id)).all():
        session.add(RecipeIngredient(recipe_id=duplicate.id, position=ingredient.position, group_name=ingredient.group_name, quantity=ingredient.quantity, unit=ingredient.unit, item=ingredient.item, preparation=ingredient.preparation, note=ingredient.note, is_optional=ingredient.is_optional))
    for step in session.scalars(select(RecipeStep).where(RecipeStep.recipe_id == source.id)).all():
        session.add(RecipeStep(recipe_id=duplicate.id, position=step.position, section=step.section, instruction=step.instruction))
    session.commit()
    session.refresh(duplicate)
    return _detail_dict(session, duplicate)


@router.get("/{recipe_id}/scale", response_model=RecipeScaleResponse)
def scale_recipe(
    recipe_id: int,
    target_servings: float | None = Query(default=None, gt=0),
    scale_factor: float | None = Query(default=None, gt=0),
    current_user: User = Depends(_require_recipes_access),
    session: Session = Depends(get_db_session),
) -> dict[str, object]:
    if target_servings is None and scale_factor is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either target_servings or scale_factor is required.")

    recipe = _get_recipe(session, recipe_id, current_user)
    ingredients = [
        _ingredient_dict(ingredient)
        for ingredient in session.scalars(select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id).order_by(RecipeIngredient.position)).all()
    ]
    steps = [
        _step_dict(session, step)
        for step in session.scalars(select(RecipeStep).where(RecipeStep.recipe_id == recipe.id).order_by(RecipeStep.position)).all()
    ]
    scaled = scale_ingredients(ingredients, base_servings=recipe.servings, target_servings=target_servings, scale_factor=scale_factor)
    step_ingredient_ids = {
        cast(int, step["id"]): cast(list[int], step["ingredient_ids"])
        for step in steps
    }
    scaled_steps = scale_linked_steps(
        steps,
        scaled_ingredients=scaled["ingredients"],
        step_ingredient_ids=step_ingredient_ids,
    )
    return {
        "recipe_id": recipe.id,
        "base_servings": recipe.servings,
        **scaled,
        "steps": scaled_steps,
    }
