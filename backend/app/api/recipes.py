from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
from app.models.core import (
    Recipe,
    RecipeCategory,
    RecipeCategoryLink,
    RecipeFeedback,
    RecipeIngredient,
    RecipeStep,
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
    ImportRecipeBackupRequest,
    ImportRecipeBackupResponse,
    ImportRecipeUrlRequest,
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
from app.services.recipes.feedback import feedback_reviewer as _feedback_reviewer
from app.services.recipes.importer import fetch_recipe_payload_from_url as _fetch_recipe_payload_from_url
from app.services.recipes.ownership import (
    get_category_for_owner as _get_category,
    get_recipe_for_owner as _get_recipe,
    get_tag_for_owner as _get_tag,
)
from app.services.recipes.serialization import (
    category_dict as _category_dict,
    detail_dict as _detail_dict,
    feedback_dict as _feedback_dict,
    ingredient_dict as _ingredient_dict,
    step_dict as _step_dict,
    summary_dict as _summary_dict,
    tag_dict as _tag_dict,
)
from app.services.recipes.service import (
    apply_recipe_payload as _apply_recipe_payload,
    validate_owned_refs as _validate_owned_refs,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])
_require_recipes_access = require_module_access(MODULE_RECIPES, UserRole.PARENT_ADMIN, UserRole.PARENT)


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
    stmt = select(Recipe).where(Recipe.household_id == current_user.household_id)
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


@router.post("/import-url", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def import_recipe_url(payload: ImportRecipeUrlRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe_payload = _fetch_recipe_payload_from_url(str(payload.url))
    recipe = Recipe(household_id=current_user.household_id, owner_user_id=current_user.id, title=recipe_payload.title)
    session.add(recipe)
    session.flush()
    _apply_recipe_payload(session, recipe, recipe_payload)
    session.commit()
    session.refresh(recipe)
    return _detail_dict(session, recipe)


@router.get("/backup", response_model=dict)
def export_recipe_backup(current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipes = session.scalars(select(Recipe).where(Recipe.household_id == current_user.household_id).order_by(Recipe.title)).unique().all()
    return {"version": 1, "recipes": [_detail_dict(session, recipe) for recipe in recipes]}


@router.post("/backup/import", response_model=ImportRecipeBackupResponse, status_code=status.HTTP_201_CREATED)
def import_recipe_backup(payload: ImportRecipeBackupRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    imported_rows: list[Recipe] = []
    for recipe_payload in payload.recipes:
        _validate_owned_refs(session, current_user, recipe_payload)
        recipe = Recipe(household_id=current_user.household_id, owner_user_id=current_user.id, title=recipe_payload.title)
        session.add(recipe)
        session.flush()
        _apply_recipe_payload(session, recipe, recipe_payload)
        imported_rows.append(recipe)
    session.commit()
    imported: list[dict[str, object]] = []
    for recipe in imported_rows:
        session.refresh(recipe)
        imported.append(_detail_dict(session, recipe))
    return {"imported_count": len(imported), "recipes": imported}


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
    recipe = _get_recipe(session, recipe_id, current_user, manage=True)
    _validate_owned_refs(session, current_user, payload, recipe_id=recipe.id)
    _apply_recipe_payload(session, recipe, payload)
    session.commit()
    session.refresh(recipe)
    return _detail_dict(session, recipe)


@router.patch("/{recipe_id}/archive", response_model=RecipeDetailResponse)
def archive_recipe(recipe_id: int, payload: ArchiveRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = _get_recipe(session, recipe_id, current_user, manage=True)
    recipe.archived_at = datetime.now(UTC) if payload.archived else None
    session.commit()
    session.refresh(recipe)
    return _detail_dict(session, recipe)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> None:
    recipe = _get_recipe(session, recipe_id, current_user, manage=True)
    session.delete(recipe)
    session.commit()


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
