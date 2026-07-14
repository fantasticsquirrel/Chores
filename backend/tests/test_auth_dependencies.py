from __future__ import annotations

from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user, require_roles
from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.models.core import Child, Household, User
from app.models.enums import UserRole
from app.security import hash_password
from app.security.sessions import SESSION_COOKIE_NAME, create_session_token


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "auth_dependencies.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_users() -> tuple[User, User]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()

        child = Child(household_id=household.id, name="Kid", active=True)
        session.add(child)
        session.flush()

        parent_user = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT,
            child_id=None,
        )
        child_user = User(
            household_id=household.id,
            email="child@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.CHILD,
            child_id=child.id,
        )
        session.add_all([parent_user, child_user])
        session.commit()
        session.refresh(parent_user)
        session.refresh(child_user)
        return parent_user, child_user


def _build_test_app() -> FastAPI:
    app = FastAPI()

    @app.get("/auth-only")
    def auth_only(user: User = Depends(get_current_user)) -> dict[str, str]:
        return {"role": user.role.value}

    @app.get("/parent-only")
    def parent_only(user: User = Depends(require_roles(UserRole.PARENT, UserRole.PARENT_ADMIN))) -> dict[str, str]:
        return {"role": user.role.value}

    return app


def _create_token(user_id: int) -> str:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        token = create_session_token(
            session,
            user_id,
            max_age_seconds=settings.session_max_age_seconds,
        )
        session.commit()
        return token


def test_get_current_user_requires_valid_session_cookie(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    initialize_database(get_settings())
    app = _build_test_app()

    with TestClient(app) as client:
        response = client.get("/auth-only")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated."

        client.cookies.set(SESSION_COOKIE_NAME, "invalid-token")
        response = client.get("/auth-only")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated."


def test_require_roles_enforces_user_role(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent_user, child_user = _create_users()
    app = _build_test_app()

    with TestClient(app) as client:
        child_token = _create_token(child_user.id)
        client.cookies.set(SESSION_COOKIE_NAME, child_token)
        child_response = client.get("/parent-only")
        assert child_response.status_code == 403
        assert child_response.json()["detail"] == "Forbidden."

        parent_token = _create_token(parent_user.id)
        client.cookies.set(SESSION_COOKIE_NAME, parent_token)
        parent_response = client.get("/parent-only")
        assert parent_response.status_code == 200
        assert parent_response.json()["role"] == UserRole.PARENT.value
