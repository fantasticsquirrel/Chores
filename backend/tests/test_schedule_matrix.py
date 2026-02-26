from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory
from app.main import app
from app.db import initialize_database
from app.models.core import Child, Chore, ChoreRotationMember, Household, User
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, ScheduleUnit, UserRole
from app.security import hash_password
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME


def _configure(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "schedule_matrix.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    initialize_database(get_settings())


def _seed_household_with_parent_and_children() -> tuple[int, int, int]:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        hh = Household(name="Home", timezone="UTC")
        session.add(hh)
        session.flush()

        c1 = Child(household_id=hh.id, name="A", active=True)
        c2 = Child(household_id=hh.id, name="B", active=True)
        session.add_all([c1, c2])

        parent = User(
            household_id=hh.id,
            email="parent@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT,
            child_id=None,
        )
        session.add(parent)
        session.commit()
        return hh.id, c1.id, c2.id


def _login_parent(client: TestClient) -> str:
    resp = client.post("/chore-api/auth/login", json={"email": "parent@example.com", "password": "password123"})
    assert resp.status_code == 200
    token = resp.cookies.get(CSRF_COOKIE_NAME)
    assert token is not None
    return token


def _create_chore(**kwargs) -> int:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        chore = Chore(**kwargs)
        session.add(chore)
        session.commit()
        return chore.id


def test_every_x_days_chore_eligibility(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    household_id, child_id, _ = _seed_household_with_parent_and_children()

    chore_id = _create_chore(
        household_id=household_id,
        name="Every 2 days",
        reward_cents=100,
        start_date=date(2026, 2, 1),
        schedule_mode=ScheduleMode.EVERY,
        schedule_interval=2,
        schedule_unit=ScheduleUnit.DAY,
        completion_mode=CompletionMode.PER_CHILD,
        assignment_mode=AssignmentMode.STATIC,
    )

    with TestClient(app) as client:
        _login_parent(client)
        off_day = client.get("/chore-api/children/me/eligible-chores?date=2026-02-02&child_id=%d" % child_id)
        assert off_day.status_code == 200
        assert all(item["chore_id"] != chore_id for item in off_day.json())

        on_day = client.get("/chore-api/children/me/eligible-chores?date=2026-02-03&child_id=%d" % child_id)
        assert on_day.status_code == 200
        assert any(item["chore_id"] == chore_id for item in on_day.json())


def test_once_with_timeout_expires(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    household_id, child_id, _ = _seed_household_with_parent_and_children()

    chore_id = _create_chore(
        household_id=household_id,
        name="Once then expires",
        reward_cents=100,
        start_date=date(2026, 2, 1),
        schedule_mode=ScheduleMode.ONCE,
        schedule_interval=None,
        schedule_unit=None,
        completion_mode=CompletionMode.PER_CHILD,
        assignment_mode=AssignmentMode.STATIC,
        timeout_days=1,
    )

    with TestClient(app) as client:
        _login_parent(client)
        expired = client.get("/chore-api/children/me/eligible-chores?date=2026-02-04&child_id=%d" % child_id)
        assert expired.status_code == 200
        assert all(item["chore_id"] != chore_id for item in expired.json())


def test_after_completion_resets_by_interval(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    household_id, child_id, _ = _seed_household_with_parent_and_children()

    chore_id = _create_chore(
        household_id=household_id,
        name="Reset every 2 days after completion",
        reward_cents=125,
        start_date=date(2026, 2, 1),
        schedule_mode=ScheduleMode.AFTER_COMPLETION,
        schedule_interval=2,
        schedule_unit=ScheduleUnit.DAY,
        completion_mode=CompletionMode.PER_CHILD,
        assignment_mode=AssignmentMode.STATIC,
    )

    with TestClient(app) as client:
        csrf = _login_parent(client)
        day1 = client.get("/chore-api/children/me/eligible-chores?date=2026-02-01&child_id=%d" % child_id)
        assert any(item["chore_id"] == chore_id for item in day1.json())

        submission = client.post(
            f"/chore-api/submissions?child_id={child_id}",
            json={"for_date": "2026-02-01", "chore_ids": [chore_id]},
            headers={CSRF_HEADER_NAME: csrf},
        )
        assert submission.status_code == 201
        submission_id = submission.json()["id"]
        approved = client.post(f"/chore-api/submissions/{submission_id}/approve-all", headers={CSRF_HEADER_NAME: csrf})
        assert approved.status_code == 200

        day2 = client.get("/chore-api/children/me/eligible-chores?date=2026-02-02&child_id=%d" % child_id)
        assert all(item["chore_id"] != chore_id for item in day2.json())

        day3 = client.get("/chore-api/children/me/eligible-chores?date=2026-02-03&child_id=%d" % child_id)
        assert any(item["chore_id"] == chore_id for item in day3.json())


def test_rotating_every_day_assigns_different_children(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    household_id, child_a, child_b = _seed_household_with_parent_and_children()

    chore_id = _create_chore(
        household_id=household_id,
        name="Rotate daily",
        reward_cents=100,
        start_date=date(2026, 2, 1),
        schedule_mode=ScheduleMode.EVERY,
        schedule_interval=1,
        schedule_unit=ScheduleUnit.DAY,
        completion_mode=CompletionMode.PER_CHILD,
        assignment_mode=AssignmentMode.ROTATING,
    )

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        session.add_all(
            [
                ChoreRotationMember(chore_id=chore_id, child_id=child_a, position=0),
                ChoreRotationMember(chore_id=chore_id, child_id=child_b, position=1),
            ]
        )
        session.commit()

    with TestClient(app) as client:
        _login_parent(client)
        a_day1 = client.get("/chore-api/children/me/eligible-chores?date=2026-02-01&child_id=%d" % child_a)
        b_day1 = client.get("/chore-api/children/me/eligible-chores?date=2026-02-01&child_id=%d" % child_b)
        assert any(item["chore_id"] == chore_id for item in a_day1.json())
        assert all(item["chore_id"] != chore_id for item in b_day1.json())

        a_day2 = client.get("/chore-api/children/me/eligible-chores?date=2026-02-02&child_id=%d" % child_a)
        b_day2 = client.get("/chore-api/children/me/eligible-chores?date=2026-02-02&child_id=%d" % child_b)
        assert all(item["chore_id"] != chore_id for item in a_day2.json())
        assert any(item["chore_id"] == chore_id for item in b_day2.json())
