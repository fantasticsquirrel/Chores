from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Household, User
from app.models.enums import UserRole
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME
from app.security import hash_password, verify_password
from app.security.sessions import SESSION_COOKIE_MAX_AGE_SECONDS


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


def _create_child_user(
    *,
    household_id: int,
    child_name: str = "Jordan",
    child_email: str = "jordan@example.com",
    child_password: str = "kid-password-123",
    active: bool = True,
) -> tuple[Child, User, str]:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        child = Child(household_id=household_id, name=child_name, active=active)
        session.add(child)
        session.flush()

        user = User(
            household_id=household_id,
            email=child_email.lower(),
            password_hash=hash_password(child_password),
            role=UserRole.CHILD,
            child_id=child.id,
        )
        session.add(user)
        session.commit()
        session.refresh(child)
        session.refresh(user)
        return child, user, child_password


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
        assert CSRF_COOKIE_NAME in login_response.cookies
        assert login_response.json()["csrf_token"] == login_response.cookies[CSRF_COOKIE_NAME]

        me_response = client.get("/chore-api/auth/me")
        assert me_response.status_code == 200
        assert me_response.json()["user"]["id"] == user.id
        assert me_response.json()["csrf_token"] == login_response.cookies[CSRF_COOKIE_NAME]


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


def test_child_login_uses_parent_email_child_name_and_child_password(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, _parent_password = _create_parent_user(email="parent@example.com")
    child, child_user, child_password = _create_child_user(
        household_id=parent.household_id,
        child_name="Jordan",
        child_email="generated-jordan@example.com",
    )

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/child-login",
            json={
                "parent_email": " PARENT@example.com ",
                "child_name": " jordan ",
                "password": child_password,
            },
        )

    assert response.status_code == 200
    payload = response.json()["user"]
    assert payload["id"] == child_user.id
    assert payload["household_id"] == parent.household_id
    assert payload["email"] == child_user.email
    assert payload["role"] == UserRole.CHILD.value
    assert payload["child_id"] == child.id
    assert "chore_tracker_session" in response.cookies
    assert CSRF_COOKIE_NAME in response.cookies
    assert response.json()["csrf_token"] == response.cookies[CSRF_COOKIE_NAME]


def test_child_login_rejects_unknown_parent_email(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, _parent_password = _create_parent_user(email="parent@example.com")
    _create_child_user(household_id=parent.household_id)

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/child-login",
            json={
                "parent_email": "missing-parent@example.com",
                "child_name": "Jordan",
                "password": "kid-password-123",
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid child login credentials."


def test_child_login_rejects_wrong_child_password(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, _parent_password = _create_parent_user(email="parent@example.com")
    _create_child_user(household_id=parent.household_id, child_name="Jordan")

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/child-login",
            json={
                "parent_email": "parent@example.com",
                "child_name": "Jordan",
                "password": "wrong-password",
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid child login credentials."


def test_child_login_rejects_duplicate_child_names(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, _parent_password = _create_parent_user(email="parent@example.com")
    _create_child_user(
        household_id=parent.household_id,
        child_name="Jordan",
        child_email="jordan-one@example.com",
    )
    _create_child_user(
        household_id=parent.household_id,
        child_name=" jordan ",
        child_email="jordan-two@example.com",
    )

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/child-login",
            json={
                "parent_email": "parent@example.com",
                "child_name": "AVA",
                "password": "kid-password-123",
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid child login credentials."


def test_child_login_rejects_inactive_child(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, _parent_password = _create_parent_user(email="parent@example.com")
    _create_child_user(
        household_id=parent.household_id,
        child_name="Jordan",
        active=False,
    )

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/child-login",
            json={
                "parent_email": "parent@example.com",
                "child_name": "Jordan",
                "password": "kid-password-123",
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid child login credentials."


def test_logout_clears_session_cookie(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )
        csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
        assert csrf_token is not None

        logout_response = client.post(
            "/chore-api/auth/logout",
            headers={CSRF_HEADER_NAME: csrf_token},
        )
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


def test_write_with_session_requires_csrf_token(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )
        assert login_response.status_code == 200

        response = client.post("/chore-api/auth/logout")

    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF token missing or invalid."


def test_login_sets_expected_cookie_attributes(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )

    assert response.status_code == 200
    set_cookie_headers = response.headers.get_list("set-cookie")

    session_cookie_header = next(
        header for header in set_cookie_headers if header.startswith("chore_tracker_session=")
    )
    assert "HttpOnly" in session_cookie_header
    assert "SameSite=lax" in session_cookie_header
    assert "Path=/" in session_cookie_header
    assert f"Max-Age={SESSION_COOKIE_MAX_AGE_SECONDS}" in session_cookie_header

    csrf_cookie_header = next(header for header in set_cookie_headers if header.startswith(f"{CSRF_COOKIE_NAME}="))
    assert "HttpOnly" not in csrf_cookie_header
    assert "SameSite=lax" in csrf_cookie_header
    assert "Path=/" in csrf_cookie_header
    assert f"Max-Age={SESSION_COOKIE_MAX_AGE_SECONDS}" in csrf_cookie_header




def test_login_ignores_forwarded_https_from_untrusted_peer(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/auth/login",
            headers={"X-Forwarded-Proto": "https"},
            json={"email": user.email, "password": password},
        )

    assert response.status_code == 200
    set_cookie_headers = response.headers.get_list("set-cookie")
    session_cookie_header = next(header for header in set_cookie_headers if header.startswith("chore_tracker_session="))
    csrf_cookie_header = next(header for header in set_cookie_headers if header.startswith(f"{CSRF_COOKIE_NAME}="))
    assert "Secure" not in session_cookie_header
    assert "Secure" not in csrf_cookie_header

def test_me_rejects_tampered_session_cookie(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )
        assert login_response.status_code == 200

        client.cookies.set("chore_tracker_session", "tampered-token")
        me_response = client.get("/chore-api/auth/me")

    assert me_response.status_code == 401
    assert me_response.json()["detail"] == "Not authenticated."


def test_change_password_updates_password_hash_and_accepts_new_password(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, original_password = _create_parent_user()
    new_password = "new-password-456"

    with TestClient(app) as client:
        login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": original_password},
        )
        assert login_response.status_code == 200
        csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
        assert csrf_token is not None

        change_response = client.post(
            "/chore-api/auth/change-password",
            headers={CSRF_HEADER_NAME: csrf_token},
            json={"current_password": original_password, "new_password": new_password},
        )
        assert change_response.status_code == 204

        client.post("/chore-api/auth/logout", headers={CSRF_HEADER_NAME: csrf_token})

        old_login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": original_password},
        )
        assert old_login_response.status_code == 401

        new_login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": new_password},
        )
        assert new_login_response.status_code == 200

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        db_user = session.get(User, user.id)
        assert db_user is not None
        assert verify_password(new_password, db_user.password_hash) is True


def test_change_password_rejects_invalid_current_password(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )
        assert login_response.status_code == 200
        csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
        assert csrf_token is not None

        response = client.post(
            "/chore-api/auth/change-password",
            headers={CSRF_HEADER_NAME: csrf_token},
            json={"current_password": "incorrect-current-password", "new_password": "new-password-456"},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect."


def test_change_password_requires_minimum_new_password_length(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, password = _create_parent_user()

    with TestClient(app) as client:
        login_response = client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": password},
        )
        assert login_response.status_code == 200
        csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
        assert csrf_token is not None

        response = client.post(
            "/chore-api/auth/change-password",
            headers={CSRF_HEADER_NAME: csrf_token},
            json={"current_password": password, "new_password": "short"},
        )

    assert response.status_code == 422
