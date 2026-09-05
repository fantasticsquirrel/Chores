"""Household-scoped recipe backup staging and serialization."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.identity import User
from app.models.recipes import Recipe
from app.schemas.recipes import ImportRecipeBackupRequest
from app.services.recipes.management import create_owned_recipe
from app.services.recipes.serialization import detail_dict

RECIPE_BACKUP_VERSION = 1


def serialize_household_recipe_backup(
    session: Session,
    actor: User,
) -> dict[str, object]:
    recipes = session.scalars(
        select(Recipe)
        .where(Recipe.household_id == actor.household_id)
        .order_by(Recipe.title)
    ).unique()
    return {
        "version": RECIPE_BACKUP_VERSION,
        "recipes": [detail_dict(session, recipe) for recipe in recipes],
    }


def stage_owned_recipe_backup_import(
    session: Session,
    actor: User,
    payload: ImportRecipeBackupRequest,
) -> list[Recipe]:
    return [create_owned_recipe(session, actor, recipe_payload) for recipe_payload in payload.recipes]


def serialize_recipe_backup_import(
    session: Session,
    recipes: list[Recipe],
) -> dict[str, object]:
    imported = [detail_dict(session, recipe) for recipe in recipes]
    return {"imported_count": len(imported), "recipes": imported}
