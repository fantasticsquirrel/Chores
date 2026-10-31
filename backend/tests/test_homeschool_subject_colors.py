from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_engine, get_session_factory, initialize_database
from app.main import app
from app.models import Child, User
from app.models.enums import UserRole
from app.models.homeschool import HomeschoolSubject
from app.security import hash_password
from household_fixtures import household_with_owner


COLOR_CONFLICT_DETAIL = (
    "Color #aabbcc is already used by another subject in this household. "
    "Choose a different color."
)


def _configure(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'subject-colors.db'}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def _seed_parent() -> tuple[User, str]:
    settings = get_settings()
    initialize_database(settings)
    password = "password123"
    with get_session_factory(settings.database_url)() as session:
        household = household_with_owner(session, name="Color Family", timezone="UTC")
        child = Child(household_id=household.id, name="Maya", active=True)
        parent = User(
            household_id=household.id,
            email="color-parent@example.test",
            password_hash=hash_password(password),
            role=UserRole.PARENT_ADMIN,
        )
        session.add_all((child, parent))
        session.commit()
        session.refresh(parent)
        return parent, password


def _login(client: TestClient, parent: User, password: str) -> str:
    response = client.post(
        "/chore-api/auth/login",
        json={"email": parent.email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["csrf_token"]


def _create_subject(
    client: TestClient,
    csrf_token: str,
    household_id: int,
    *,
    name: str,
    color: str,
):
    return client.post(
        "/chore-api/homeschool/subjects",
        headers={"X-CSRF-Token": csrf_token},
        json={"household_id": household_id, "name": name, "color": color},
    )


def test_create_normalizes_hex_and_rejects_canonical_household_duplicate(
    tmp_path: Path, monkeypatch
) -> None:
    _configure(tmp_path, monkeypatch)
    parent, password = _seed_parent()

    with TestClient(app) as client:
        csrf_token = _login(client, parent, password)
        created = _create_subject(
            client,
            csrf_token,
            parent.household_id,
            name="Art",
            color="#AbC",
        )
        duplicate = _create_subject(
            client,
            csrf_token,
            parent.household_id,
            name="Drawing",
            color="#AABBCC",
        )
        invalid = _create_subject(
            client,
            csrf_token,
            parent.household_id,
            name="Invalid",
            color="blue",
        )

    assert created.status_code == 201
    assert created.json()["color"] == "#aabbcc"
    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": COLOR_CONFLICT_DETAIL}
    assert invalid.status_code == 422


def test_update_excludes_self_and_rejects_another_subject_color(
    tmp_path: Path, monkeypatch
) -> None:
    _configure(tmp_path, monkeypatch)
    parent, password = _seed_parent()

    with TestClient(app) as client:
        csrf_token = _login(client, parent, password)
        art = _create_subject(
            client,
            csrf_token,
            parent.household_id,
            name="Art",
            color="#abc",
        ).json()
        math = _create_subject(
            client,
            csrf_token,
            parent.household_id,
            name="Math",
            color="#123456",
        ).json()

        self_update = client.put(
            f"/chore-api/homeschool/subjects/{art['id']}",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": parent.household_id,
                "name": "Visual Art",
                "color": "#AABBCC",
                "active": False,
            },
        )
        conflicting_update = client.put(
            f"/chore-api/homeschool/subjects/{math['id']}",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": parent.household_id,
                "name": "Mathematics",
                "color": "#ABC",
                "active": True,
            },
        )

    assert self_update.status_code == 200
    assert self_update.json()["id"] == art["id"]
    assert self_update.json()["name"] == "Visual Art"
    assert self_update.json()["color"] == "#aabbcc"
    assert self_update.json()["active"] is False
    assert conflicting_update.status_code == 409
    assert conflicting_update.json() == {"detail": COLOR_CONFLICT_DETAIL}


def test_same_canonical_color_is_allowed_in_another_household(
    tmp_path: Path, monkeypatch
) -> None:
    _configure(tmp_path, monkeypatch)
    parent, password = _seed_parent()
    settings = get_settings()
    with get_session_factory(settings.database_url)() as session:
        other = household_with_owner(session, name="Other Family", timezone="UTC")
        session.add(
            HomeschoolSubject(
                household_id=other.id,
                name="Other Art",
                color="#aabbcc",
                active=True,
            )
        )
        session.commit()

    with TestClient(app) as client:
        csrf_token = _login(client, parent, password)
        response = _create_subject(
            client,
            csrf_token,
            parent.household_id,
            name="Art",
            color="#ABC",
        )

    assert response.status_code == 201
    assert response.json()["color"] == "#aabbcc"


def test_legacy_duplicates_survive_and_unrelated_update_with_same_color_works(
    tmp_path: Path, monkeypatch
) -> None:
    _configure(tmp_path, monkeypatch)
    parent, password = _seed_parent()
    settings = get_settings()
    engine = get_engine(settings.database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "DROP TRIGGER IF EXISTS trg_homeschool_subject_color_insert"
        )
        connection.exec_driver_sql(
            "DROP TRIGGER IF EXISTS trg_homeschool_subject_color_update"
        )
    with get_session_factory(settings.database_url)() as session:
        first = HomeschoolSubject(
            household_id=parent.household_id,
            name="Legacy Art",
            color="#abc",
            active=True,
        )
        second = HomeschoolSubject(
            household_id=parent.household_id,
            name="Legacy Drawing",
            color="#AABBCC",
            active=True,
        )
        session.add_all((first, second))
        session.commit()
        first_id = first.id
    initialize_database(settings)

    with TestClient(app) as client:
        csrf_token = _login(client, parent, password)
        response = client.put(
            f"/chore-api/homeschool/subjects/{first_id}",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "household_id": parent.household_id,
                "name": "Legacy Art Renamed",
                "color": "#ABC",
                "active": False,
            },
        )

    assert response.status_code == 200
    assert response.json()["color"] == "#aabbcc"
    with get_session_factory(settings.database_url)() as session:
        rows = list(
            session.scalars(
                select(HomeschoolSubject)
                .where(HomeschoolSubject.household_id == parent.household_id)
                .order_by(HomeschoolSubject.id)
            )
        )
    assert [(row.name, row.color, row.active) for row in rows] == [
        ("Legacy Art Renamed", "#aabbcc", False),
        ("Legacy Drawing", "#AABBCC", True),
    ]
