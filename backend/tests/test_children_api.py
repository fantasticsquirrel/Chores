from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory
from app.main import app
from app.models.core import Household, User
from app.models.enums import UserRole
from app.security import hash_password
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "children_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_household() -> int:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.commit()
        return household.id


def _create_parent_user(household_id: int, email: str = "parent@example.com", password: str = "password123") -> str:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        user = User(
            household_id=household_id,
            email=email.lower(),
            password_hash=hash_password(password),
            role=UserRole.PARENT,
            child_id=None,
        )
        session.add(user)
        session.commit()
    return password


def _login_parent(client: TestClient, email: str = "parent@example.com", password: str = "password123") -> str:
    login_response = client.post(
        "/chore-api/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    csrf_token = login_response.cookies.get(CSRF_COOKIE_NAME)
    assert csrf_token is not None
    return csrf_token


def test_children_primary_flow(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)

        create_response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "  Riley  ", "active": True},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

        assert create_response.status_code == 201
        created = create_response.json()
        assert created["household_id"] == household_id
        assert created["name"] == "Riley"
        assert created["active"] is True

        list_response = client.get(f"/chore-api/children?household_id={household_id}")
        assert list_response.status_code == 200
        assert [child["name"] for child in list_response.json()] == ["Riley"]

        update_response = client.patch(
            f"/chore-api/children/{created['id']}",
            json={"household_id": household_id, "name": "  Rowan ", "active": False},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert update_response.status_code == 200
        assert update_response.json()["name"] == "Rowan"
        assert update_response.json()["active"] is False

        active_only_response = client.get(f"/chore-api/children?household_id={household_id}&active_only=true")
        assert active_only_response.status_code == 200
        assert active_only_response.json() == []


def test_patch_child_supports_partial_active_update(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        created = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
            headers={CSRF_HEADER_NAME: csrf_token},
        ).json()

        response = client.patch(
            f"/chore-api/children/{created['id']}",
            json={"household_id": household_id, "active": False},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 200
    assert response.json()["name"] == "Riley"
    assert response.json()["active"] is False


def test_update_child_returns_not_found(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        response = client.patch(
            "/chore-api/children/999",
            json={"household_id": household_id, "name": "Missing"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Child not found."


def test_create_child_rejects_whitespace_only_name(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "   "},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any(detail["loc"][-1] == "name" for detail in details)


def test_patch_child_requires_name_or_active(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        created = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
            headers={CSRF_HEADER_NAME: csrf_token},
        ).json()

        response = client.patch(
            f"/chore-api/children/{created['id']}",
            json={"household_id": household_id},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any("At least one field must be provided for update." in detail["msg"] for detail in details)


def test_create_child_invalid_household_returns_bad_request(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        response = client.post(
            "/chore-api/children",
            json={"household_id": 9999, "name": "Riley"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden."


def test_list_children_requires_positive_household_id(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        _login_parent(client)
        response = client.get("/chore-api/children?household_id=0")

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any(detail["loc"][-1] == "household_id" for detail in details)


def test_patch_child_requires_positive_child_id(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        response = client.patch(
            "/chore-api/children/0",
            json={"household_id": household_id, "name": "Riley"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any(detail["loc"][-1] == "child_id" for detail in details)

def test_child_account_email_must_be_globally_unique_on_create(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        first_household_id = _create_household()
        _create_parent_user(first_household_id, email="first-parent@example.com")
        first_csrf = _login_parent(client, email="first-parent@example.com")
        first_child = client.post(
            "/chore-api/children",
            json={"household_id": first_household_id, "name": "Riley"},
            headers={CSRF_HEADER_NAME: first_csrf},
        ).json()
        first_account = client.post(
            f"/chore-api/children/{first_child['id']}/account",
            json={"household_id": first_household_id, "email": "shared-child@example.com", "password": "password123"},
            headers={CSRF_HEADER_NAME: first_csrf},
        )
        assert first_account.status_code == 201

        second_household_id = _create_household()
        _create_parent_user(second_household_id, email="second-parent@example.com")
        second_csrf = _login_parent(client, email="second-parent@example.com")
        second_child = client.post(
            "/chore-api/children",
            json={"household_id": second_household_id, "name": "Avery"},
            headers={CSRF_HEADER_NAME: second_csrf},
        ).json()
        duplicate_response = client.post(
            f"/chore-api/children/{second_child['id']}/account",
            json={"household_id": second_household_id, "email": "shared-child@example.com", "password": "password123"},
            headers={CSRF_HEADER_NAME: second_csrf},
        )

    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "Email is already in use."


def test_child_account_email_must_be_globally_unique_on_reset(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        first_household_id = _create_household()
        _create_parent_user(first_household_id, email="first-parent@example.com")
        first_csrf = _login_parent(client, email="first-parent@example.com")
        first_child = client.post(
            "/chore-api/children",
            json={"household_id": first_household_id, "name": "Riley"},
            headers={CSRF_HEADER_NAME: first_csrf},
        ).json()
        first_account = client.post(
            f"/chore-api/children/{first_child['id']}/account",
            json={"household_id": first_household_id, "email": "taken-child@example.com", "password": "password123"},
            headers={CSRF_HEADER_NAME: first_csrf},
        )
        assert first_account.status_code == 201

        second_household_id = _create_household()
        _create_parent_user(second_household_id, email="second-parent@example.com")
        second_csrf = _login_parent(client, email="second-parent@example.com")
        second_child = client.post(
            "/chore-api/children",
            json={"household_id": second_household_id, "name": "Avery"},
            headers={CSRF_HEADER_NAME: second_csrf},
        ).json()
        second_account = client.post(
            f"/chore-api/children/{second_child['id']}/account",
            json={"household_id": second_household_id, "email": "unique-child@example.com", "password": "password123"},
            headers={CSRF_HEADER_NAME: second_csrf},
        )
        assert second_account.status_code == 201

        duplicate_response = client.patch(
            f"/chore-api/children/{second_child['id']}/account-email",
            json={"household_id": second_household_id, "email": "taken-child@example.com"},
            headers={CSRF_HEADER_NAME: second_csrf},
        )

    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "Email is already in use."


def test_parent_can_reset_linked_child_account_password(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        child = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Jordan"},
            headers={CSRF_HEADER_NAME: csrf_token},
        ).json()
        account_response = client.post(
            f"/chore-api/children/{child['id']}/account",
            json={"household_id": household_id, "email": "jordan@example.com", "password": "old-password-123"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert account_response.status_code == 201

        reset_response = client.patch(
            f"/chore-api/children/{child['id']}/account-password",
            json={"household_id": household_id, "new_password": "new-password-456"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

        assert reset_response.status_code == 200
        assert reset_response.json()["email"] == "jordan@example.com"
        assert reset_response.json()["child_id"] == child["id"]

        old_login_response = client.post(
            "/chore-api/auth/login",
            json={"email": "jordan@example.com", "password": "old-password-123"},
        )
        assert old_login_response.status_code == 401

        new_login_response = client.post(
            "/chore-api/auth/login",
            json={"email": "jordan@example.com", "password": "new-password-456"},
        )
        assert new_login_response.status_code == 200
        assert new_login_response.json()["user"]["role"] == "CHILD"


def test_reset_child_account_password_returns_not_found_without_linked_account(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        child = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Jordan"},
            headers={CSRF_HEADER_NAME: csrf_token},
        ).json()

        response = client.patch(
            f"/chore-api/children/{child['id']}/account-password",
            json={"household_id": household_id, "new_password": "new-password-456"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "No linked child account found."


def test_reset_child_account_password_rejects_cross_household_payload(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        first_household_id = _create_household()
        _create_parent_user(first_household_id, email="first-parent@example.com")
        first_csrf = _login_parent(client, email="first-parent@example.com")
        first_child = client.post(
            "/chore-api/children",
            json={"household_id": first_household_id, "name": "Jordan"},
            headers={CSRF_HEADER_NAME: first_csrf},
        ).json()
        account_response = client.post(
            f"/chore-api/children/{first_child['id']}/account",
            json={"household_id": first_household_id, "email": "jordan@example.com", "password": "old-password-123"},
            headers={CSRF_HEADER_NAME: first_csrf},
        )
        assert account_response.status_code == 201

        second_household_id = _create_household()
        _create_parent_user(second_household_id, email="second-parent@example.com")
        second_csrf = _login_parent(client, email="second-parent@example.com")

        response = client.patch(
            f"/chore-api/children/{first_child['id']}/account-password",
            json={"household_id": first_household_id, "new_password": "new-password-456"},
            headers={CSRF_HEADER_NAME: second_csrf},
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden."


def test_reset_child_account_password_requires_minimum_length(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        response = client.patch(
            "/chore-api/children/1/account-password",
            json={"household_id": household_id, "new_password": "short"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any(detail["loc"][-1] == "new_password" for detail in details)
