from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Household, User
from app.models.enums import UserRole
from app.security import hash_password


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "auth_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_parent_user(email: str = "parent@example.com", password: str = "password123") -> tuple[User, str]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()

        user = User(
            household_id=household.id,
            email=email.lower(),
            password_hash=hash_password(password),
            role=UserRole.PARENT,
            child_id=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user, password


def test_login_and_me_flow(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    user, password = _create_parent_user()

    with TestClient(app) as client:
        login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )
        assert login_response.status_code == 200
        payload = login_response.json()["user"]
        assert payload["id"] == user.id
        assert payload["household_id"] == user.household_id
        assert payload["email"] == user.email
        assert payload["role"] == UserRole.PARENT.value
        assert payload["child_id"] is None

        assert "chore_tracker_session" in login_response.cookies

        me_response = client.get("/chore-api/auth/me")
        assert me_response.status_code == 200
        assert me_response.json()["user"]["id"] == user.id


def test_login_rejects_invalid_credentials(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _password = _create_parent_user()

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": "wrong-password"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_logout_clears_session_cookie(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )
        logout_response = client.post("/chore-api/auth/logout")
        assert logout_response.status_code == 204

        me_response = client.get("/chore-api/auth/me")

    assert me_response.status_code == 401
    assert me_response.json()["detail"] == "Not authenticated."


def test_me_requires_authenticated_session(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        response = client.get("/chore-api/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."
