from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Household, User
from app.models.enums import UserRole
from app.security import hash_password


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "modules_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_user(role: UserRole, email: str = "user@example.com", password: str = "password123") -> tuple[User, str]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()

        child_id = None
        if role == UserRole.CHILD:
            child = Child(household_id=household.id, name="Kid", active=True)
            session.add(child)
            session.flush()
            child_id = child.id

        user = User(
            household_id=household.id,
            email=email.lower(),
            password_hash=hash_password(password),
            role=role,
            child_id=child_id,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user, password


def _login(client: TestClient, user: User, password: str) -> None:
    response = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200


def test_parent_admin_sees_all_default_modules(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_user(UserRole.PARENT_ADMIN, email="admin@example.com")

    with TestClient(app) as client:
        _login(client, user, password)
        response = client.get("/chore-api/modules/me")

    assert response.status_code == 200
    assert [module["key"] for module in response.json()["modules"]] == ["chores", "homeschool", "admin"]


def test_child_sees_chores_only_by_default(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_user(UserRole.CHILD, email="child@example.com")

    with TestClient(app) as client:
        _login(client, user, password)
        response = client.get("/chore-api/modules/me")

    assert response.status_code == 200
    assert [module["key"] for module in response.json()["modules"]] == ["chores"]


def test_modules_me_requires_session(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        response = client.get("/chore-api/modules/me")

    assert response.status_code == 401


def test_parent_admin_can_list_household_user_module_access(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-list@example.com")

    with TestClient(app) as client:
        _login(client, admin, password)
        response = client.get("/chore-api/modules/users")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["email"] == admin.email
    assert [module["key"] for module in payload[0]["modules"]] == ["chores", "homeschool", "admin"]


def test_parent_admin_can_override_user_module_access(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-override@example.com")

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": admin.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        response = client.put(
            f"/chore-api/modules/users/{admin.id}",
            headers={"X-CSRF-Token": csrf_token},
            json={"module_key": "homeschool", "can_view": False},
        )

    assert response.status_code == 200
    assert [module["key"] for module in response.json()["modules"]] == ["chores", "admin"]


def test_parent_cannot_list_module_access_admin_endpoint(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, password = _create_user(UserRole.PARENT, email="parent-modules@example.com")

    with TestClient(app) as client:
        _login(client, parent, password)
        response = client.get("/chore-api/modules/users")

    assert response.status_code == 403
