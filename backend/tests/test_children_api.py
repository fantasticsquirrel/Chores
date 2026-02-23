from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory
from app.main import app
from app.models.core import Household


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


def test_children_primary_flow(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()

        create_response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "  Riley  ", "active": True},
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
        created = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
        ).json()

        response = client.patch(
            f"/chore-api/children/{created['id']}",
            json={"household_id": household_id, "active": False},
        )

    assert response.status_code == 200
    assert response.json()["name"] == "Riley"
    assert response.json()["active"] is False


def test_update_child_returns_not_found(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        response = client.patch(
            "/chore-api/children/999",
            json={"household_id": household_id, "name": "Missing"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Child not found."


def test_create_child_rejects_whitespace_only_name(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "   "},
        )

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any(detail["loc"][-1] == "name" for detail in details)


def test_patch_child_requires_name_or_active(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        created = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
        ).json()

        response = client.patch(
            f"/chore-api/children/{created['id']}",
            json={"household_id": household_id},
        )

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any("At least one field must be provided for update." in detail["msg"] for detail in details)


def test_create_child_invalid_household_returns_bad_request(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        response = client.post(
            "/chore-api/children",
            json={"household_id": 9999, "name": "Riley"},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid household reference."


def test_list_children_requires_positive_household_id(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        response = client.get("/chore-api/children?household_id=0")

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any(detail["loc"][-1] == "household_id" for detail in details)


def test_patch_child_requires_positive_child_id(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        response = client.patch(
            "/chore-api/children/0",
            json={"household_id": household_id, "name": "Riley"},
        )

    assert response.status_code == 422
    details = response.json()["detail"]
    assert any(detail["loc"][-1] == "child_id" for detail in details)
