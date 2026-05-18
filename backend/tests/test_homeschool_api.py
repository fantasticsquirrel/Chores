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
    db_file = tmp_path / "homeschool_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _create_parent_fixture(password: str = "password123") -> tuple[User, Child, str]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()
        child = Child(household_id=household.id, name="Avery", active=True)
        session.add(child)
        session.flush()
        user = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash=hash_password(password),
            role=UserRole.PARENT_ADMIN,
            child_id=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        session.refresh(child)
        return user, child, password


def _login(client: TestClient, user: User, password: str) -> str:
    response = client.post("/chore-api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200
    token = response.json()["csrf_token"]
    assert token
    return token


def test_parent_can_create_and_list_homeschool_semester(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, _child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        create_response = client.post(
            "/chore-api/homeschool/semesters",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "name": "Fall 2026",
                "start_date": "2026-08-15",
                "end_date": "2026-12-20",
            },
        )
        list_response = client.get(f"/chore-api/homeschool/semesters?household_id={user.household_id}")

    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Fall 2026"
    assert list_response.status_code == 200
    assert [row["name"] for row in list_response.json()] == ["Fall 2026"]


def test_parent_can_create_subject_and_upsert_attendance(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    user, child, password = _create_parent_fixture()

    with TestClient(app) as client:
        csrf_token = _login(client, user, password)
        subject_response = client.post(
            "/chore-api/homeschool/subjects",
            headers={"X-CSRF-Token": csrf_token},
            json={"household_id": user.household_id, "name": "Math", "color": "#ef4444"},
        )
        assert subject_response.status_code == 201
        subject_id = subject_response.json()["id"]

        attendance_response = client.put(
            "/chore-api/homeschool/attendance",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": user.household_id,
                "child_id": child.id,
                "subject_id": subject_id,
                "date": "2026-09-01",
                "present": True,
                "comment": "Fractions",
            },
        )
        list_response = client.get(
            f"/chore-api/homeschool/attendance?household_id={user.household_id}&child_id={child.id}"
        )

    assert attendance_response.status_code == 200
    assert attendance_response.json()["comment"] == "Fractions"
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["subject_id"] == subject_id


def test_child_role_cannot_access_parent_homeschool_endpoints(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    parent, child, _password = _create_parent_fixture()
    child_password = "password123"
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        child_user = User(
            household_id=parent.household_id,
            email="child@example.com",
            password_hash=hash_password(child_password),
            role=UserRole.CHILD,
            child_id=child.id,
        )
        session.add(child_user)
        session.commit()
        session.refresh(child_user)

    with TestClient(app) as client:
        _login(client, child_user, child_password)
        response = client.get(f"/chore-api/homeschool/semesters?household_id={parent.household_id}")

    assert response.status_code == 403
