from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import get_settings
from app.db import get_session_factory
from app.main import app
from app.models.chores import Chore, ChoreRotationState
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, UserRole
from app.models.identity import Child, Household, User
from app.security import hash_password
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME


PASSWORD = "password123"


def _configure(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'chores_api.db'}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _seed_family() -> dict[str, object]:
    session_factory = get_session_factory(get_settings().database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        other_household = Household(name="Other Home", timezone="UTC")
        session.add_all([household, other_household])
        session.flush()

        parent = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash=hash_password(PASSWORD),
            role=UserRole.PARENT,
            active=True,
        )
        other_parent = User(
            household_id=household.id,
            email="other-parent@example.com",
            password_hash=hash_password(PASSWORD),
            role=UserRole.PARENT,
            active=True,
        )
        child_one = Child(household_id=household.id, name="Riley", active=True)
        child_two = Child(household_id=household.id, name="Maya", active=True)
        foreign_child = Child(household_id=other_household.id, name="Morgan", active=True)
        session.add_all([parent, other_parent, child_one, child_two, foreign_child])
        session.commit()

        return {
            "household_id": household.id,
            "other_household_id": other_household.id,
            "parent_id": parent.id,
            "other_parent_id": other_parent.id,
            "child_ids": [child_one.id, child_two.id],
            "foreign_child_id": foreign_child.id,
        }


def _login(client: TestClient, email: str = "parent@example.com") -> str:
    response = client.post("/chore-api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    csrf = response.cookies.get(CSRF_COOKIE_NAME)
    assert csrf is not None
    return csrf


def _chore_payload(household_id: int, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "household_id": household_id,
        "name": "Kitchen reset",
        "reward_cents": 250,
        "start_date": "2026-09-01",
        "schedule_mode": "NONE",
        "completion_mode": "PER_CHILD",
        "assignment_mode": "STATIC",
        "allowed_child_ids": [],
        "rotation_order": [],
    }
    payload.update(overrides)
    return payload


def test_rotating_assignment_round_trips_in_order_and_clears_state_when_made_static(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        family = _seed_family()
        household_id = int(family["household_id"])
        child_one, child_two = family["child_ids"]
        csrf = _login(client)

        created = client.post(
            "/chore-api/chores",
            headers={CSRF_HEADER_NAME: csrf},
            json=_chore_payload(
                household_id,
                assignment_mode="ROTATING",
                rotation_order=[child_two, child_one],
            ),
        )

        assert created.status_code == 201
        assert created.json()["rotation_order"] == [child_two, child_one]
        assert set(created.json()["allowed_child_ids"]) == {child_one, child_two}
        chore_id = created.json()["id"]

        session_factory = get_session_factory(get_settings().database_url)
        with session_factory() as session:
            session.add(ChoreRotationState(chore_id=chore_id, current_position=1))
            session.commit()

        updated = client.patch(
            f"/chore-api/chores/{chore_id}",
            headers={CSRF_HEADER_NAME: csrf},
            json={
                "household_id": household_id,
                "assignment_mode": "STATIC",
                "allowed_child_ids": [child_two],
            },
        )

        assert updated.status_code == 200
        assert updated.json()["assignment_mode"] == "STATIC"
        assert updated.json()["allowed_child_ids"] == [child_two]
        assert updated.json()["rotation_order"] == []

        listed = client.get(f"/chore-api/chores?household_id={household_id}")
        assert listed.status_code == 200
        assert listed.json() == [updated.json()]

    with get_session_factory(get_settings().database_url)() as session:
        assert session.get(ChoreRotationState, chore_id) is None


def test_chore_management_preserves_scoped_lookup_and_owner_error_shapes(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        family = _seed_family()
        household_id = int(family["household_id"])
        other_household_id = int(family["other_household_id"])
        csrf = _login(client)

        foreign_child = client.post(
            "/chore-api/chores",
            headers={CSRF_HEADER_NAME: csrf},
            json=_chore_payload(household_id, allowed_child_ids=[family["foreign_child_id"]]),
        )
        assert foreign_child.status_code == 422
        assert foreign_child.json()["detail"] == (
            f"Child IDs not found in this household: [{family['foreign_child_id']}]"
        )

        other_owner = client.post(
            "/chore-api/chores",
            headers={CSRF_HEADER_NAME: csrf},
            json=_chore_payload(
                household_id,
                owner_user_id=family["other_parent_id"],
                reward_cents=0,
            ),
        )
        assert other_owner.status_code == 403
        assert other_owner.json()["detail"] == "Parents can only manage their own personal chores."

        wrong_household = client.get(f"/chore-api/chores?household_id={other_household_id}")
        assert wrong_household.status_code == 403
        assert wrong_household.json()["detail"] == "Forbidden."

        session_factory = get_session_factory(get_settings().database_url)
        with session_factory() as session:
            hidden = Chore(
                household_id=other_household_id,
                name="Hidden chore",
                reward_cents=0,
                start_date=date(2026, 9, 1),
                schedule_mode=ScheduleMode.NONE,
                completion_mode=CompletionMode.PER_CHILD,
                assignment_mode=AssignmentMode.STATIC,
            )
            session.add(hidden)
            session.commit()
            hidden_id = hidden.id

        hidden_update = client.patch(
            f"/chore-api/chores/{hidden_id}",
            headers={CSRF_HEADER_NAME: csrf},
            json={"household_id": household_id, "name": "Probe"},
        )
        assert hidden_update.status_code == 404
        assert hidden_update.json()["detail"] == "Chore not found."

    with get_session_factory(get_settings().database_url)() as session:
        assert session.scalar(select(func.count(Chore.id)).where(Chore.household_id == household_id)) == 0


def test_failed_assignment_update_rolls_back_and_personal_completion_stays_owner_scoped(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        family = _seed_family()
        household_id = int(family["household_id"])
        csrf = _login(client)

        created = client.post(
            "/chore-api/chores",
            headers={CSRF_HEADER_NAME: csrf},
            json=_chore_payload(household_id),
        )
        assert created.status_code == 201
        chore_id = created.json()["id"]

        invalid_update = client.patch(
            f"/chore-api/chores/{chore_id}",
            headers={CSRF_HEADER_NAME: csrf},
            json={"household_id": household_id, "assignment_mode": "ROTATING"},
        )
        assert invalid_update.status_code == 422
        assert invalid_update.json()["detail"] == (
            "rotation_order must contain at least 2 children when assignment_mode is ROTATING."
        )

        after_failure = client.get(f"/chore-api/chores?household_id={household_id}")
        assert after_failure.status_code == 200
        assert after_failure.json()[0]["assignment_mode"] == "STATIC"

        personal = client.post(
            "/chore-api/chores",
            headers={CSRF_HEADER_NAME: csrf},
            json=_chore_payload(
                household_id,
                owner_user_id=family["parent_id"],
                name="Weekly planning",
                reward_cents=0,
            ),
        )
        assert personal.status_code == 201

        other_csrf = _login(client, "other-parent@example.com")
        forbidden = client.post(
            f"/chore-api/chores/{personal.json()['id']}/complete?date=2026-09-01",
            headers={CSRF_HEADER_NAME: other_csrf},
        )
        assert forbidden.status_code == 403
        assert forbidden.json()["detail"] == "This personal chore belongs to another parent."

        due_for_other_parent = client.get("/chore-api/chores/me/today?date=2026-09-01")
        assert due_for_other_parent.status_code == 200
        assert due_for_other_parent.json() == []

        owner_csrf = _login(client)
        due_for_owner = client.get("/chore-api/chores/me/today?date=2026-09-01")
        assert due_for_owner.status_code == 200
        assert due_for_owner.json() == [personal.json()]

        completed = client.post(
            f"/chore-api/chores/{personal.json()['id']}/complete?date=2026-09-01",
            headers={CSRF_HEADER_NAME: owner_csrf},
        )
        assert completed.status_code == 204
        assert client.get("/chore-api/chores/me/today?date=2026-09-01").json() == []


def test_archive_preserves_no_content_conflict_and_inactive_list_shapes(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        family = _seed_family()
        household_id = int(family["household_id"])
        csrf = _login(client)
        created = client.post(
            "/chore-api/chores",
            headers={CSRF_HEADER_NAME: csrf},
            json=_chore_payload(household_id),
        )
        assert created.status_code == 201
        chore_id = created.json()["id"]

        archived = client.delete(
            f"/chore-api/chores/{chore_id}?household_id={household_id}",
            headers={CSRF_HEADER_NAME: csrf},
        )
        assert archived.status_code == 204
        assert archived.content == b""

        active = client.get(f"/chore-api/chores?household_id={household_id}")
        assert active.status_code == 200
        assert active.json() == []

        including_archived = client.get(
            f"/chore-api/chores?household_id={household_id}&active_only=false"
        )
        assert including_archived.status_code == 200
        assert len(including_archived.json()) == 1
        assert including_archived.json()[0]["id"] == chore_id
        assert including_archived.json()[0]["is_active"] is False
        assert including_archived.json()[0]["archived_at"] is not None

        already_archived = client.delete(
            f"/chore-api/chores/{chore_id}?household_id={household_id}",
            headers={CSRF_HEADER_NAME: csrf},
        )
        assert already_archived.status_code == 409
        assert already_archived.json()["detail"] == "Chore is already archived."


def test_chore_management_routes_retain_authentication_and_parent_role_guards(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure(tmp_path, monkeypatch)

    with TestClient(app) as client:
        family = _seed_family()
        household_id = int(family["household_id"])

        anonymous = client.get(f"/chore-api/chores?household_id={household_id}")
        assert anonymous.status_code == 401
        assert anonymous.json()["detail"] == "Not authenticated."

        session_factory = get_session_factory(get_settings().database_url)
        with session_factory() as session:
            session.add(
                User(
                    household_id=household_id,
                    email="child@example.com",
                    password_hash=hash_password(PASSWORD),
                    role=UserRole.CHILD,
                    child_id=int(family["child_ids"][0]),
                    active=True,
                )
            )
            session.commit()

        _login(client, "child@example.com")
        wrong_role = client.get(f"/chore-api/chores?household_id={household_id}")
        assert wrong_role.status_code == 403
        assert wrong_role.json()["detail"] == "Forbidden."
