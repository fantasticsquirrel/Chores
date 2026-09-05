from __future__ import annotations

from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.db import get_session_factory, initialize_database
from app.models.enums import UserRole
from app.models.identity import Household, User
from app.models.recipes import Recipe, RecipeCategory
from app.schemas.recipes import CreateRecipeRequest, ImportRecipeBackupRequest
from app.services.recipes.backup import (
    serialize_household_recipe_backup,
    serialize_recipe_backup_import,
    stage_owned_recipe_backup_import,
)
from app.services.recipes.importer import stage_recipe_url_import


def _settings(database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        secret_key="a" * 32,
        log_level="INFO",
        session_cookie_secure=False,
    )


def _seed_recipe_households(session_factory) -> dict[str, int]:
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        other_household = Household(name="Other home", timezone="UTC")
        session.add_all([household, other_household])
        session.flush()
        actor = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash="hash",
            role=UserRole.PARENT,
            active=True,
        )
        family_parent = User(
            household_id=household.id,
            email="family-parent@example.com",
            password_hash="hash",
            role=UserRole.PARENT,
            active=True,
        )
        outsider = User(
            household_id=other_household.id,
            email="outsider@example.com",
            password_hash="hash",
            role=UserRole.PARENT,
            active=True,
        )
        session.add_all([actor, family_parent, outsider])
        session.flush()
        session.add_all(
            [
                Recipe(
                    household_id=household.id,
                    owner_user_id=actor.id,
                    title="Zulu Soup",
                ),
                Recipe(
                    household_id=household.id,
                    owner_user_id=family_parent.id,
                    title="Alpha Salad",
                ),
                Recipe(
                    household_id=other_household.id,
                    owner_user_id=outsider.id,
                    title="Hidden Pie",
                ),
            ]
        )
        hidden_category = RecipeCategory(
            household_id=other_household.id,
            owner_user_id=outsider.id,
            name="Hidden",
            color="#111827",
        )
        session.add(hidden_category)
        session.commit()
        return {
            "household_id": household.id,
            "actor_id": actor.id,
            "family_parent_id": family_parent.id,
            "hidden_category_id": hidden_category.id,
        }


def test_recipe_backup_service_is_household_scoped_and_title_ordered(tmp_path: Path) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'recipe-backup.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_recipe_households(session_factory)

    with session_factory() as session:
        actor = session.get(User, family["actor_id"])
        assert actor is not None

        backup = serialize_household_recipe_backup(session, actor)

    assert backup["version"] == 1
    recipes = backup["recipes"]
    assert isinstance(recipes, list)
    assert [recipe["title"] for recipe in recipes] == ["Alpha Salad", "Zulu Soup"]
    assert [recipe["owner_user_id"] for recipe in recipes] == [
        family["family_parent_id"],
        family["actor_id"],
    ]


def test_recipe_import_services_stage_for_actor_in_payload_order_without_committing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'recipe-import.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_recipe_households(session_factory)
    fetched_urls: list[str] = []

    def fake_fetch(url: str) -> CreateRecipeRequest:
        fetched_urls.append(url)
        return CreateRecipeRequest(title="Fetched Recipe")

    monkeypatch.setattr("app.services.recipes.importer.fetch_recipe_payload_from_url", fake_fetch)

    with session_factory() as session:
        actor = session.get(User, family["actor_id"])
        assert actor is not None
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit

        imported_from_url = stage_recipe_url_import(
            session,
            actor,
            "https://example.com/recipe",
        )
        imported_from_backup = stage_owned_recipe_backup_import(
            session,
            actor,
            ImportRecipeBackupRequest(
                recipes=[
                    CreateRecipeRequest(title="Second in Request"),
                    CreateRecipeRequest(title="Third in Request"),
                ]
            ),
        )
        session.flush()
        response = serialize_recipe_backup_import(session, imported_from_backup)

        assert fetched_urls == ["https://example.com/recipe"]
        assert imported_from_url.household_id == family["household_id"]
        assert imported_from_url.owner_user_id == family["actor_id"]
        assert [recipe.title for recipe in imported_from_backup] == [
            "Second in Request",
            "Third in Request",
        ]
        assert [recipe["title"] for recipe in response["recipes"]] == [
            "Second in Request",
            "Third in Request",
        ]
        assert response["imported_count"] == 2
        commit.assert_not_called()


def test_recipe_backup_import_service_rejects_cross_household_references_without_committing(
    tmp_path: Path,
) -> None:
    settings = _settings(f"sqlite:///{tmp_path / 'recipe-import-scope.db'}")
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    family = _seed_recipe_households(session_factory)

    with session_factory() as session:
        actor = session.get(User, family["actor_id"])
        assert actor is not None
        commit = Mock(side_effect=AssertionError("service must not commit"))
        session.commit = commit

        with pytest.raises(HTTPException) as exc_info:
            stage_owned_recipe_backup_import(
                session,
                actor,
                ImportRecipeBackupRequest(
                    recipes=[
                        CreateRecipeRequest(title="Would Be First"),
                        CreateRecipeRequest(
                            title="Invalid Second",
                            category_ids=[family["hidden_category_id"]],
                        ),
                    ]
                ),
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Recipe category not found."
        commit.assert_not_called()
