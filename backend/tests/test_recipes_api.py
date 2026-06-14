from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Household, User
from app.models.enums import UserRole
from app.security import hash_password
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "recipes_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_user(
    *,
    email: str,
    password: str = "password123",
    role: UserRole = UserRole.PARENT,
    household_id: int | None = None,
) -> tuple[User, str]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        if household_id is None:
            household = Household(name="Home", timezone="UTC")
            session.add(household)
            session.flush()
            household_id = household.id

        child_id = None
        if role == UserRole.CHILD:
            child = Child(household_id=household_id, name=email.split("@", 1)[0], active=True)
            session.add(child)
            session.flush()
            child_id = child.id

        user = User(
            household_id=household_id,
            email=email.lower(),
            password_hash=hash_password(password),
            role=role,
            child_id=child_id,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user, password


def _login(client: TestClient, user: User, password: str) -> dict[str, str]:
    response = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200
    csrf = response.cookies[CSRF_COOKIE_NAME]
    return {CSRF_HEADER_NAME: csrf}


def _category_payload(name: str = "Dinner") -> dict[str, object]:
    return {"name": name, "color": "#f97316"}


def _tag_payload(name: str = "Quick") -> dict[str, object]:
    return {"name": name}


def _recipe_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "title": "Pancakes",
        "description": "Weekend breakfast",
        "source_name": "Family card",
        "source_url": "https://example.com/pancakes",
        "prep_minutes": 10,
        "cook_minutes": 15,
        "servings": 4,
        "yield_quantity": None,
        "yield_unit": "",
        "rating": 5,
        "favorite": True,
        "notes": "Rest batter for best texture.",
        "parent_recipe_id": None,
        "category_ids": [],
        "tag_ids": [],
        "ingredients": [
            {"position": 1, "group_name": "Batter", "quantity": 2, "unit": "cup", "item": "flour", "preparation": "", "note": "", "is_optional": False},
            {"position": 2, "group_name": "Batter", "quantity": 1, "unit": "cup", "item": "milk", "preparation": "", "note": "", "is_optional": False},
        ],
        "steps": [
            {"position": 1, "section": "Batter", "instruction": "Whisk dry ingredients.", "ingredient_position_refs": [1]},
            {"position": 2, "section": "Cook", "instruction": "Cook on a hot griddle."},
        ],
        "components": [],
    }
    payload.update(overrides)
    return payload


def test_recipes_module_is_available_to_parents_only(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, parent_password = _create_user(email="parent@example.com", role=UserRole.PARENT)
    child, child_password = _create_user(email="child@example.com", role=UserRole.CHILD, household_id=parent.household_id)

    with TestClient(app) as client:
        _login(client, parent, parent_password)
        parent_modules = client.get("/chore-api/modules/me")
        assert parent_modules.status_code == 200
        assert "recipes" in {module["key"] for module in parent_modules.json()["modules"]}

    with TestClient(app) as client:
        _login(client, child, child_password)
        child_modules = client.get("/chore-api/modules/me")
        assert child_modules.status_code == 200
        assert "recipes" not in {module["key"] for module in child_modules.json()["modules"]}
        denied = client.get("/chore-api/recipes")
        assert denied.status_code == 403


def test_parent_can_create_and_read_full_recipe(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, password = _create_user(email="parent@example.com")

    with TestClient(app) as client:
        headers = _login(client, parent, password)
        category = client.post("/chore-api/recipes/categories", json=_category_payload(), headers=headers)
        assert category.status_code == 201
        tag = client.post("/chore-api/recipes/tags", json=_tag_payload(), headers=headers)
        assert tag.status_code == 201

        payload = _recipe_payload(category_ids=[category.json()["id"]], tag_ids=[tag.json()["id"]])
        created = client.post("/chore-api/recipes", json=payload, headers=headers)
        assert created.status_code == 201
        recipe = created.json()
        assert recipe["owner_user_id"] == parent.id
        assert recipe["title"] == "Pancakes"
        assert recipe["categories"][0]["name"] == "Dinner"
        assert recipe["tags"][0]["name"] == "Quick"
        assert [ingredient["item"] for ingredient in recipe["ingredients"]] == ["flour", "milk"]
        assert [step["instruction"] for step in recipe["steps"]] == ["Whisk dry ingredients.", "Cook on a hot griddle."]
        assert recipe["steps"][0]["ingredient_ids"] == [recipe["ingredients"][0]["id"]]

        fetched = client.get(f"/chore-api/recipes/{recipe['id']}")
        assert fetched.status_code == 200
        assert fetched.json()["id"] == recipe["id"]


def test_recipes_are_scoped_to_parent_account_not_household(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent_one, password_one = _create_user(email="one@example.com")
    parent_two, password_two = _create_user(email="two@example.com", household_id=parent_one.household_id)

    with TestClient(app) as client:
        headers = _login(client, parent_one, password_one)
        created = client.post("/chore-api/recipes", json=_recipe_payload(title="Private Pancakes"), headers=headers)
        assert created.status_code == 201
        recipe_id = created.json()["id"]

    with TestClient(app) as client:
        _login(client, parent_two, password_two)
        listing = client.get("/chore-api/recipes")
        assert listing.status_code == 200
        assert listing.json() == []
        missing = client.get(f"/chore-api/recipes/{recipe_id}")
        assert missing.status_code == 404


def test_recipe_filters_variants_components_and_scaling(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, password = _create_user(email="parent@example.com")

    with TestClient(app) as client:
        headers = _login(client, parent, password)
        category = client.post("/chore-api/recipes/categories", json=_category_payload("Breakfast"), headers=headers).json()
        tag = client.post("/chore-api/recipes/tags", json=_tag_payload("Weekend"), headers=headers).json()
        sauce = client.post("/chore-api/recipes", json=_recipe_payload(title="Berry Sauce", ingredients=[], steps=[]), headers=headers).json()
        base = client.post(
            "/chore-api/recipes",
            json=_recipe_payload(
                title="Waffles",
                category_ids=[category["id"]],
                tag_ids=[tag["id"]],
                components=[{"component_recipe_id": sauce["id"], "label": "topping", "quantity": 1, "unit": "batch"}],
            ),
            headers=headers,
        ).json()
        variant = client.post("/chore-api/recipes", json=_recipe_payload(title="Gluten-Free Waffles", parent_recipe_id=base["id"]), headers=headers).json()

        filtered = client.get("/chore-api/recipes", params={"query": "waff", "category_id": category["id"], "tag_id": tag["id"], "ingredient": "flour", "favorite": True, "min_rating": 5})
        assert filtered.status_code == 200
        assert [recipe["title"] for recipe in filtered.json()] == ["Waffles"]

        detail = client.get(f"/chore-api/recipes/{base['id']}")
        assert detail.status_code == 200
        assert detail.json()["components"][0]["component_recipe"]["title"] == "Berry Sauce"
        assert detail.json()["variants"][0]["id"] == variant["id"]

        scaled = client.get(f"/chore-api/recipes/{base['id']}/scale", params={"target_servings": 8})
        assert scaled.status_code == 200
        assert scaled.json()["factor"] == 2
        assert scaled.json()["ingredients"][0]["scaled_quantity"] == 4
        assert scaled.json()["steps"][0]["scaled_instruction"] == "Whisk dry ingredients. Uses: 4 cup flour."


def test_update_archive_and_duplicate_recipe(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, password = _create_user(email="parent@example.com")

    with TestClient(app) as client:
        headers = _login(client, parent, password)
        created = client.post("/chore-api/recipes", json=_recipe_payload(), headers=headers).json()
        updated = client.put(
            f"/chore-api/recipes/{created['id']}",
            json=_recipe_payload(title="Updated Pancakes", ingredients=[{"position": 1, "group_name": "", "quantity": 3, "unit": "cup", "item": "oats", "preparation": "", "note": "", "is_optional": False}]),
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["title"] == "Updated Pancakes"
        assert [ingredient["item"] for ingredient in updated.json()["ingredients"]] == ["oats"]

        duplicate = client.post(f"/chore-api/recipes/{created['id']}/duplicate", json={"title": "Mini Pancakes", "as_variant": True}, headers=headers)
        assert duplicate.status_code == 201
        assert duplicate.json()["parent_recipe_id"] == created["id"]

        archived = client.patch(f"/chore-api/recipes/{created['id']}/archive", json={"archived": True}, headers=headers)
        assert archived.status_code == 200
        assert archived.json()["archived_at"] is not None
        active_listing = client.get("/chore-api/recipes")
        assert all(recipe["id"] != created["id"] for recipe in active_listing.json())
        all_listing = client.get("/chore-api/recipes", params={"active_only": False})
        assert any(recipe["id"] == created["id"] for recipe in all_listing.json())
