from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Household, Module, SecurityAuditEvent, User
from app.models.enums import UserRole
from app.security import hash_password
from app.services.modules import ModuleService


def _configure(tmp_path: Path, monkeypatch) -> tuple[User, User, str]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'household-modules.db'}")
    monkeypatch.setenv("SECRET_KEY", "h" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()
        admin = User(
            household_id=household.id,
            email="admin@example.test",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT_ADMIN,
        )
        parent = User(
            household_id=household.id,
            email="parent@example.test",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT,
        )
        session.add_all([admin, parent])
        session.commit()
        session.refresh(admin)
        session.refresh(parent)
        return admin, parent, "password123"


def _login(client: TestClient, user: User, password: str) -> dict[str, str]:
    response = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["csrf_token"]}


def test_admin_manager_can_list_household_module_toggles(tmp_path: Path, monkeypatch) -> None:
    admin, _, password = _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        _login(client, admin, password)
        response = client.get("/chore-api/modules/household")

    assert response.status_code == 200
    assert response.json() == [
        {
            "key": "chores",
            "name": "Chores",
            "description": "Chore assignments, submissions, approvals, and rewards.",
            "can_manage": True,
            "enabled": True,
            "can_disable": True,
        },
        {
            "key": "homeschool",
            "name": "Homeschool",
            "description": "Attendance, subjects, semesters, comments, and homeschool reporting.",
            "can_manage": True,
            "enabled": True,
            "can_disable": True,
        },
        {
            "key": "recipes",
            "name": "Recipes",
            "description": "Personal recipe collection, ingredients, scaling, and cooking notes.",
            "can_manage": True,
            "enabled": True,
            "can_disable": True,
        },
        {
            "key": "admin",
            "name": "Admin",
            "description": "Household users, child accounts, and module access controls.",
            "can_manage": True,
            "enabled": True,
            "can_disable": False,
        },
    ]


def test_parent_cannot_list_or_set_household_module_toggles(tmp_path: Path, monkeypatch) -> None:
    _, parent, password = _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        headers = _login(client, parent, password)
        listed = client.get("/chore-api/modules/household")
        updated = client.put(
            "/chore-api/modules/household/chores",
            headers=headers,
            json={"enabled": False},
        )

    assert listed.status_code == 403
    assert updated.status_code == 403


def test_view_only_parent_admin_cannot_list_or_set_household_module_toggles(tmp_path: Path, monkeypatch) -> None:
    admin, _, password = _configure(tmp_path, monkeypatch)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        session.add(
            User(
                household_id=admin.household_id,
                email="steward@example.test",
                password_hash=hash_password(password),
                role=UserRole.PARENT_ADMIN,
            )
        )
        db_admin = session.get(User, admin.id)
        assert db_admin is not None
        ModuleService().set_user_access(
            session,
            db_admin,
            "admin",
            can_view=True,
            can_manage=False,
        )
        session.commit()

    with TestClient(app) as client:
        headers = _login(client, admin, password)
        listed = client.get("/chore-api/modules/household")
        updated = client.put(
            "/chore-api/modules/household/chores",
            headers=headers,
            json={"enabled": False},
        )

    assert listed.status_code == 403
    assert listed.json()["detail"] == "Module management access denied."
    assert updated.status_code == 403
    assert updated.json()["detail"] == "Module management access denied."


def test_household_disable_is_hard_ceiling_over_user_override_and_is_audited(tmp_path: Path, monkeypatch) -> None:
    admin, parent, password = _configure(tmp_path, monkeypatch)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        db_parent = session.get(User, parent.id)
        assert db_parent is not None
        ModuleService().set_user_access(session, db_parent, "chores", can_view=True, can_manage=True)
        session.commit()

    with TestClient(app) as client:
        headers = _login(client, admin, password)
        response = client.put(
            "/chore-api/modules/household/chores",
            headers=headers,
            json={"enabled": False},
        )

    assert response.status_code == 200
    assert response.json()["enabled"] is False

    with TestClient(app) as client:
        _login(client, parent, password)
        modules = client.get("/chore-api/modules/me")
        protected_api = client.get(f"/chore-api/chores?household_id={parent.household_id}")

    assert "chores" not in {module["key"] for module in modules.json()["modules"]}
    assert protected_api.status_code == 403
    assert protected_api.json()["detail"] == "Module access denied."

    with factory() as session:
        event = session.scalar(
            select(SecurityAuditEvent).where(SecurityAuditEvent.event_type == "module.household_access_changed")
        )
        assert event is not None
        assert event.actor_user_id == admin.id
        assert event.household_id == admin.household_id
        assert json.loads(event.details_json) == {
            "enabled": False,
            "module_key": "chores",
            "previous_enabled": True,
        }


def test_reenabling_household_module_restores_role_defaults(tmp_path: Path, monkeypatch) -> None:
    admin, parent, password = _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        headers = _login(client, admin, password)
        disabled = client.put(
            "/chore-api/modules/household/homeschool",
            headers=headers,
            json={"enabled": False},
        )
        enabled = client.put(
            "/chore-api/modules/household/homeschool",
            headers=headers,
            json={"enabled": True},
        )

    assert disabled.status_code == 200
    assert enabled.status_code == 200
    assert enabled.json()["enabled"] is True

    with TestClient(app) as client:
        _login(client, parent, password)
        modules = client.get("/chore-api/modules/me")

    assert "homeschool" in {module["key"] for module in modules.json()["modules"]}


def test_admin_module_cannot_be_disabled_household_wide(tmp_path: Path, monkeypatch) -> None:
    admin, _, password = _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        headers = _login(client, admin, password)
        response = client.put(
            "/chore-api/modules/household/admin",
            headers=headers,
            json={"enabled": False},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "The admin module cannot be disabled for a household."


def test_catalog_disabled_module_cannot_gain_latent_household_enablement(tmp_path: Path, monkeypatch) -> None:
    admin, _, password = _configure(tmp_path, monkeypatch)
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        ModuleService().ensure_catalog(session)
        module = session.get(Module, "chores")
        assert module is not None
        module.enabled = False
        session.commit()

    with TestClient(app) as client:
        headers = _login(client, admin, password)
        response = client.put(
            "/chore-api/modules/household/chores",
            headers=headers,
            json={"enabled": True},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "This module is disabled globally and cannot be enabled for a household."
    )


def test_unknown_household_module_key_is_rejected(tmp_path: Path, monkeypatch) -> None:
    admin, _, password = _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        headers = _login(client, admin, password)
        response = client.put(
            "/chore-api/modules/household/not-a-module",
            headers=headers,
            json={"enabled": False},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unknown module key."
