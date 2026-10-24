from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.config import get_settings
from app.db import initialize_database, get_session_factory
from app.main import app
from app.models import Child, User, SecurityAuditEvent, HouseholdModuleAccess
from app.models.enums import UserRole
from app.security import hash_password
from app.services.modules import ModuleService
from household_fixtures import household_with_owner


@pytest.fixture
def actors(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/discovery.db")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        household = household_with_owner(session, name="Home")
        outsider = household_with_owner(session, name="Other")
        kid = Child(household_id=household.id, name="Kid", active=True)
        sibling = Child(household_id=household.id, name="Sibling", active=True)
        other = Child(household_id=outsider.id, name="Other", active=True)
        session.add_all([kid, sibling, other])
        session.flush()
        parent = User(
            household_id=household.id,
            email="parent@test.com",
            role=UserRole.PARENT,
            password_hash=hash_password("password123"),
        )
        child = User(
            household_id=household.id,
            email="kid@test.com",
            role=UserRole.CHILD,
            child_id=kid.id,
            password_hash=hash_password("password123"),
        )
        session.add_all([parent, child])
        session.flush()
        ModuleService().set_household_access(
            session, household_id=household.id, module_key="discovery-lab", enabled=True
        )
        session.commit()
        return factory, parent, child, kid.id, sibling.id, other.id


def login(client, user):
    assert (
        client.post(
            "/chore-api/auth/login",
            json={"email": user.email, "password": "password123"},
        ).status_code
        == 200
    )
    return {"X-CSRF-Token": client.cookies.get("chore_tracker_csrf")}


def test_catalog_defaults_and_filters(actors):
    _, parent, child, kid, _, _ = actors
    with TestClient(app) as client:
        assert client.get("/chore-api/discovery/explorations").status_code == 401
        login(client, child)
        result = client.get("/chore-api/discovery/explorations")
        assert result.status_code == 200
        assert len(result.json()) == 26
        assert (
            client.get("/chore-api/discovery/explorations?q=moon").json()[0]["id"]
            == "moon-phases"
        )
        assert (
            client.get("/chore-api/discovery/explorations/unknown").status_code == 404
        )


def test_bulk_access_persists_and_direct_child_denial(actors):
    factory, parent, child, kid, _, _ = actors
    with TestClient(app) as client:
        headers = login(client, parent)
        payload = {"enabled": False, "exploration_ids": ["moon-phases", "gravity"]}
        assert (
            client.put(
                f"/chore-api/discovery/children/{kid}/access", json=payload
            ).status_code
            == 403
        )
        changed = client.put(
            f"/chore-api/discovery/children/{kid}/access", json=payload, headers=headers
        )
        assert changed.status_code == 200
        assert sum(not item["enabled"] for item in changed.json()["explorations"]) == 2
        login(client, child)
        assert len(client.get("/chore-api/discovery/explorations").json()) == 24
        assert (
            client.get("/chore-api/discovery/explorations/moon-phases").status_code
            == 403
        )
        assert (
            client.get("/chore-api/discovery/explorations/gravity").status_code == 403
        )
        headers = login(client, parent)
        assert (
            client.put(
                f"/chore-api/discovery/children/{kid}/access",
                json={"enabled": True, "exploration_ids": ["moon-phases"]},
                headers=headers,
            ).status_code
            == 200
        )
        login(client, child)
        assert (
            client.get("/chore-api/discovery/explorations/moon-phases").status_code
            == 200
        )
        assert (
            client.get("/chore-api/discovery/explorations/gravity").status_code == 403
        )
    with factory() as session:
        assert (
            len(
                session.scalars(
                    select(SecurityAuditEvent).where(
                        SecurityAuditEvent.event_type == "discovery.access.updated"
                    )
                ).all()
            )
            == 2
        )


def test_scope_roles_and_invalid_selections(actors):
    _, parent, child, kid, sibling, other = actors
    with TestClient(app) as client:
        headers = login(client, child)
        assert client.get("/chore-api/discovery/children").status_code == 403
        assert (
            client.get(f"/chore-api/discovery/children/{kid}/access").status_code == 403
        )
        assert (
            client.get(
                f"/chore-api/discovery/explorations?child_id={sibling}"
            ).status_code
            == 403
        )
        assert (
            client.put(
                f"/chore-api/discovery/children/{kid}/access",
                json={"enabled": True, "tag": "space"},
                headers=headers,
            ).status_code
            == 403
        )
        headers = login(client, parent)
        assert (
            client.get(f"/chore-api/discovery/children/{other}/access").status_code
            == 404
        )
        assert (
            client.get(
                f"/chore-api/discovery/explorations?child_id={other}"
            ).status_code
            == 404
        )
        for payload in (
            {"enabled": False},
            {"enabled": False, "exploration_ids": []},
            {"enabled": False, "exploration_ids": ["unknown"]},
            {"enabled": "no", "tag": "space"},
        ):
            assert (
                client.put(
                    f"/chore-api/discovery/children/{kid}/access",
                    json=payload,
                    headers=headers,
                ).status_code
                == 422
            )


def test_module_and_manage_gates(actors):
    factory, parent, child, kid, _, _ = actors
    with factory() as session:
        ModuleService().set_user_access(
            session, session.get(User, parent.id), "discovery-lab", True, False
        )
        session.commit()
    with TestClient(app) as client:
        headers = login(client, parent)
        assert client.get("/chore-api/discovery/explorations").status_code == 200
        assert (
            client.put(
                f"/chore-api/discovery/children/{kid}/access",
                json={"enabled": False, "exploration_ids": ["gravity"]},
                headers=headers,
            ).status_code
            == 403
        )
        with factory() as session:
            ModuleService().set_household_access(
                session,
                household_id=parent.household_id,
                module_key="discovery-lab",
                enabled=False,
            )
            session.commit()
        assert client.get("/chore-api/discovery/explorations").status_code == 403
        assert (
            client.get("/chore-api/discovery/explorations/gravity").status_code == 403
        )


def test_missing_household_grant_denies_even_user_grant(actors):
    from sqlalchemy import delete

    factory, parent, child, kid, _, _ = actors
    with factory() as session:
        session.execute(
            delete(HouseholdModuleAccess).where(
                HouseholdModuleAccess.household_id == parent.household_id,
                HouseholdModuleAccess.module_key == "discovery-lab",
            )
        )
        ModuleService().set_user_access(
            session, session.get(User, child.id), "discovery-lab", True, True
        )
        session.commit()
    with TestClient(app) as client:
        login(client, child)
        assert client.get("/chore-api/discovery/explorations").status_code == 403


def test_bulk_filters_and_last_write_wins(actors):
    _, parent, _, kid, _, _ = actors
    with TestClient(app) as client:
        headers = login(client, parent)
        entries = client.get("/chore-api/discovery/explorations").json()
        sample = entries[0]
        filters = {
            "subject": sample["subject"],
            "grade_band": sample["grade_bands"][0],
            "tag": sample["tags"][0],
        }
        selected = {
            item["id"]
            for item in entries
            if item["subject"] == filters["subject"]
            and filters["grade_band"] in item["grade_bands"]
            and filters["tag"] in item["tags"]
        }
        response = client.put(
            f"/chore-api/discovery/children/{kid}/access",
            json={"enabled": False, **filters},
            headers=headers,
        )
        assert response.status_code == 200
        assert {
            item["id"]
            for item in response.json()["explorations"]
            if not item["enabled"]
        } == selected
        response = client.put(
            f"/chore-api/discovery/children/{kid}/access",
            json={"enabled": True, "exploration_ids": list(selected)},
            headers=headers,
        )
        assert all(item["enabled"] for item in response.json()["explorations"])
        assert (
            client.put(
                f"/chore-api/discovery/children/{kid}/access",
                json={"enabled": False, "tag": "nonexistent"},
                headers=headers,
            ).status_code
            == 422
        )
