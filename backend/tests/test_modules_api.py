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
