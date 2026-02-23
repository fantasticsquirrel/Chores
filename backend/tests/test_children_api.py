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
            "/children",
            json={"household_id": household_id, "name": "  Riley  ", "active": True},
        )

        assert create_response.status_code == 201
        created = create_response.json()
        assert created["household_id"] == household_id
        assert created["name"] == "Riley"
        assert created["active"] is True

        list_response = client.get(f"/children?household_id={household_id}")
        assert list_response.status_code == 200
        assert [child["name"] for child in list_response.json()] == ["Riley"]

        update_response = client.patch(
            f"/children/{created['id']}",
            json={"household_id": household_id, "name": "  Rowan ", "active": False},
        )
        assert update_response.status_code == 200
        assert update_response.json()["name"] == "Rowan"
        assert update_response.json()["active"] is False

        active_only_response = client.get(f"/children?household_id={household_id}&active_only=true")
        assert active_only_response.status_code == 200
        assert active_only_response.json() == []


def test_update_child_returns_not_found(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)

    with TestClient(app) as client:
        household_id = _create_household()
        response = client.patch(
            "/children/999",
            json={"household_id": household_id, "name": "Missing"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Child not found."
