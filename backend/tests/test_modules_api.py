from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Household, User
from app.models.enums import UserRole
from app.security import hash_password
from app.services.modules import ModuleService


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
    assert [module["key"] for module in response.json()["modules"]] == ["chores", "homeschool", "recipes", "admin"]


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
    assert [module["key"] for module in payload[0]["modules"]] == ["chores", "homeschool", "recipes", "admin"]


def test_parent_admin_can_create_additional_parent_user(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-create-parent@example.com")

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": admin.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        create_response = client.post(
            "/chore-api/modules/users",
            headers={"X-CSRF-Token": csrf_token},
            json={"email": "Second.Parent@Example.com", "password": "password456", "role": "PARENT"},
        )
        assert create_response.status_code == 201
        payload = create_response.json()
        assert payload["household_id"] == admin.household_id
        assert payload["email"] == "second.parent@example.com"
        assert payload["role"] == "PARENT"
        assert payload["child_id"] is None
        assert [module["key"] for module in payload["modules"]] == ["chores", "homeschool", "recipes"]

        client.post("/chore-api/auth/logout", headers={"X-CSRF-Token": csrf_token})
        login_created_response = client.post(
            "/chore-api/auth/login",
            json={"email": "second.parent@example.com", "password": "password456"},
        )
        assert login_created_response.status_code == 200
        assert login_created_response.json()["user"]["household_id"] == admin.household_id


def test_parent_admin_can_create_additional_parent_admin_user(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-create-admin@example.com")

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": admin.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        create_response = client.post(
            "/chore-api/modules/users",
            headers={"X-CSRF-Token": csrf_token},
            json={"email": "other.admin@example.com", "password": "password456", "role": "PARENT_ADMIN"},
        )

    assert create_response.status_code == 201
    assert create_response.json()["role"] == "PARENT_ADMIN"
    assert [module["key"] for module in create_response.json()["modules"]] == ["chores", "homeschool", "recipes", "admin"]


def test_parent_admin_cannot_create_duplicate_parent_email(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-create-duplicate@example.com")

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": admin.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        response = client.post(
            "/chore-api/modules/users",
            headers={"X-CSRF-Token": csrf_token},
            json={"email": admin.email.upper(), "password": "password456", "role": "PARENT"},
        )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already in use."


def test_parent_cannot_create_parent_user(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, password = _create_user(UserRole.PARENT, email="parent-create-parent@example.com")

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": parent.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        response = client.post(
            "/chore-api/modules/users",
            headers={"X-CSRF-Token": csrf_token},
            json={"email": "blocked@example.com", "password": "password456", "role": "PARENT"},
        )

    assert response.status_code == 403


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
    assert [module["key"] for module in response.json()["modules"]] == ["chores", "recipes", "admin"]


def test_parent_cannot_list_module_access_admin_endpoint(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, password = _create_user(UserRole.PARENT, email="parent-modules@example.com")

    with TestClient(app) as client:
        _login(client, parent, password)
        response = client.get("/chore-api/modules/users")

    assert response.status_code == 403


def test_parent_admin_cannot_remove_last_admin_module_access(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-last@example.com")

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": admin.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        response = client.put(
            f"/chore-api/modules/users/{admin.id}",
            headers={"X-CSRF-Token": csrf_token},
            json={"module_key": "admin", "can_view": False},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot remove admin module access from the last household admin."


def test_parent_admin_can_remove_admin_access_when_another_admin_remains(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-primary@example.com")

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        session.add(
            User(
                household_id=admin.household_id,
                email="admin-secondary@example.com",
                password_hash=hash_password("password123"),
                role=UserRole.PARENT_ADMIN,
                child_id=None,
            )
        )
        session.commit()

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": admin.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        response = client.put(
            f"/chore-api/modules/users/{admin.id}",
            headers={"X-CSRF-Token": csrf_token},
            json={"module_key": "admin", "can_view": False},
        )

    assert response.status_code == 200
    assert "admin" not in [module["key"] for module in response.json()["modules"]]


def test_parent_admin_without_admin_module_access_cannot_list_or_update_module_access(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    admin, password = _create_user(UserRole.PARENT_ADMIN, email="admin-disabled@example.com")

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        session.add(
            User(
                household_id=admin.household_id,
                email="admin-keeper@example.com",
                password_hash=hash_password("password123"),
                role=UserRole.PARENT_ADMIN,
                child_id=None,
            )
        )
        db_admin = session.get(User, admin.id)
        assert db_admin is not None
        ModuleService().set_user_access(session, target_user=db_admin, module_key="admin", can_view=False)
        session.commit()

    with TestClient(app) as client:
        login_response = client.post("/chore-api/auth/login", json={"email": admin.email, "password": password})
        assert login_response.status_code == 200
        csrf_token = login_response.json()["csrf_token"]

        list_response = client.get("/chore-api/modules/users")
        update_response = client.put(
            f"/chore-api/modules/users/{admin.id}",
            headers={"X-CSRF-Token": csrf_token},
            json={"module_key": "homeschool", "can_view": False},
        )

    assert list_response.status_code == 403
    assert list_response.json()["detail"] == "Module access denied."
    assert update_response.status_code == 403
    assert update_response.json()["detail"] == "Module access denied."


def test_parent_without_chores_module_access_cannot_use_chore_management_api(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, password = _create_user(UserRole.PARENT, email="parent-no-chores@example.com")

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        db_parent = session.get(User, parent.id)
        assert db_parent is not None
        ModuleService().set_user_access(session, target_user=db_parent, module_key="chores", can_view=False)
        session.commit()

    with TestClient(app) as client:
        _login(client, parent, password)
        response = client.get(f"/chore-api/chores?household_id={parent.household_id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Module access denied."


def test_child_without_chores_module_access_cannot_use_child_workflow_api(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    child, password = _create_user(UserRole.CHILD, email="child-no-chores@example.com")

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        db_child = session.get(User, child.id)
        assert db_child is not None
        ModuleService().set_user_access(session, target_user=db_child, module_key="chores", can_view=False)
        session.commit()

    with TestClient(app) as client:
        _login(client, child, password)
        response = client.get("/chore-api/children/me/eligible-chores?date=2026-02-23")

    assert response.status_code == 403
    assert response.json()["detail"] == "Module access denied."
