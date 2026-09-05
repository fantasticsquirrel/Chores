from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_module_access
from app.models.enums import UserRole
from app.models.identity import User
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
from app.services.recipes.backup import (
    serialize_household_recipe_backup,
    serialize_recipe_backup_import,
    stage_owned_recipe_backup_import,
)
from app.services.recipes.catalog import (
    create_owned_category,
    create_owned_tag,
    delete_owned_category,
    delete_owned_tag,
    list_household_recipes,
    list_owned_categories,
    list_owned_tags,
    update_owned_category,
    update_owned_tag,
)
from app.services.recipes.feedback import upsert_household_recipe_feedback
from app.services.recipes.importer import stage_recipe_url_import
from app.services.recipes.management import (
    create_owned_recipe,
    create_owned_recipe_variant,
    delete_managed_recipe,
    duplicate_household_recipe,
    set_managed_recipe_archived,
    update_managed_recipe,
)
from app.services.recipes.ownership import get_recipe_for_owner
from app.services.recipes.scaling import scale_household_recipe
from app.services.recipes.serialization import (
    category_dict,
    detail_dict,
    feedback_dict,
    summary_dict,
    tag_dict,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])
_require_recipes_access = require_module_access(MODULE_RECIPES, UserRole.PARENT_ADMIN, UserRole.PARENT)


@router.get("/categories", response_model=list[RecipeCategoryResponse])
def list_categories(current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> list[dict[str, object]]:
    return [category_dict(category) for category in list_owned_categories(session, current_user)]


@router.post("/categories", response_model=RecipeCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(payload: CreateRecipeCategoryRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    category = create_owned_category(session, current_user, payload)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe category already exists.") from exc
    session.refresh(category)
    return category_dict(category)


@router.put("/categories/{category_id}", response_model=RecipeCategoryResponse)
def update_category(category_id: int, payload: UpdateRecipeCategoryRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    category = update_owned_category(session, category_id, current_user, payload)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe category already exists.") from exc
    session.refresh(category)
    return category_dict(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> None:
    delete_owned_category(session, category_id, current_user)
    session.commit()


@router.get("/tags", response_model=list[RecipeTagResponse])
def list_tags(current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> list[dict[str, object]]:
    return [tag_dict(tag) for tag in list_owned_tags(session, current_user)]


@router.post("/tags", response_model=RecipeTagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(payload: CreateRecipeTagRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    tag = create_owned_tag(session, current_user, payload)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe tag already exists.") from exc
    session.refresh(tag)
    return tag_dict(tag)


@router.put("/tags/{tag_id}", response_model=RecipeTagResponse)
def update_tag(tag_id: int, payload: UpdateRecipeTagRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    tag = update_owned_tag(session, tag_id, current_user, payload)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe tag already exists.") from exc
    session.refresh(tag)
    return tag_dict(tag)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> None:
    delete_owned_tag(session, tag_id, current_user)
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
    recipes = list_household_recipes(
        session,
        current_user,
        query=query,
        category_id=category_id,
        tag_id=tag_id,
        favorite=favorite,
        min_rating=min_rating,
        ingredient=ingredient,
        active_only=active_only,
    )
    return [summary_dict(session, recipe) for recipe in recipes]


@router.post("", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: CreateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = create_owned_recipe(session, current_user, payload)
    session.commit()
    session.refresh(recipe)
    return detail_dict(session, recipe)


@router.post("/import-url", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def import_recipe_url(payload: ImportRecipeUrlRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = stage_recipe_url_import(session, current_user, str(payload.url))
    session.commit()
    session.refresh(recipe)
    return detail_dict(session, recipe)


@router.get("/backup", response_model=dict)
def export_recipe_backup(current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    return serialize_household_recipe_backup(session, current_user)


@router.post("/backup/import", response_model=ImportRecipeBackupResponse, status_code=status.HTTP_201_CREATED)
def import_recipe_backup(payload: ImportRecipeBackupRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    imported_rows = stage_owned_recipe_backup_import(session, current_user, payload)
    session.commit()
    for recipe in imported_rows:
        session.refresh(recipe)
    return serialize_recipe_backup_import(session, imported_rows)


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
def get_recipe(recipe_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    return detail_dict(session, get_recipe_for_owner(session, recipe_id, current_user))


@router.post("/{recipe_id}/variants", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_recipe_variant(recipe_id: int, payload: CreateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    variant = create_owned_recipe_variant(session, recipe_id, current_user, payload)
    session.commit()
    session.refresh(variant)
    return detail_dict(session, variant)


@router.put("/{recipe_id}/feedback", response_model=dict)
def upsert_recipe_feedback(recipe_id: int, payload: UpsertRecipeFeedbackRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    feedback = upsert_household_recipe_feedback(session, recipe_id, current_user, payload)
    session.commit()
    session.refresh(feedback)
    return feedback_dict(session, feedback)


@router.put("/{recipe_id}", response_model=RecipeDetailResponse)
def update_recipe(recipe_id: int, payload: UpdateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = update_managed_recipe(session, recipe_id, current_user, payload)
    session.commit()
    session.refresh(recipe)
    return detail_dict(session, recipe)


@router.patch("/{recipe_id}/archive", response_model=RecipeDetailResponse)
def archive_recipe(recipe_id: int, payload: ArchiveRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    recipe = set_managed_recipe_archived(session, recipe_id, current_user, archived=payload.archived)
    session.commit()
    session.refresh(recipe)
    return detail_dict(session, recipe)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> None:
    delete_managed_recipe(session, recipe_id, current_user)
    session.commit()


@router.post("/{recipe_id}/duplicate", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def duplicate_recipe(recipe_id: int, payload: DuplicateRecipeRequest, current_user: User = Depends(_require_recipes_access), session: Session = Depends(get_db_session)) -> dict[str, object]:
    duplicate = duplicate_household_recipe(session, recipe_id, current_user, payload)
    session.commit()
    session.refresh(duplicate)
    return detail_dict(session, duplicate)


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
    return scale_household_recipe(
        session,
        recipe_id,
        current_user,
        target_servings=target_servings,
        scale_factor=scale_factor,
    )
