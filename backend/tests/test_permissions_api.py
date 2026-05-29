from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Chore, Household, Submission, SubmissionItem, User
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, SubmissionStatus, UserRole
from app.security import hash_password
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "permissions_api.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()


def _seed_household_with_users() -> dict[str, int | str]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    target_date = date(2026, 2, 23)

    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()

        first_child = Child(household_id=household.id, name="Riley", active=True)
        second_child = Child(household_id=household.id, name="Avery", active=True)
        session.add_all([first_child, second_child])
        session.flush()

        chore = Chore(
            household_id=household.id,
            name="Dishes",
            reward_cents=350,
            start_date=target_date,
            schedule_mode=ScheduleMode.NONE,
            schedule_interval=None,
            schedule_unit=None,
            completion_mode=CompletionMode.PER_CHILD,
            assignment_mode=AssignmentMode.STATIC,
        )
        session.add(chore)
        session.flush()
        available_chore = Chore(
            household_id=household.id,
            name="Sweep",
            reward_cents=200,
            start_date=target_date,
            schedule_mode=ScheduleMode.NONE,
            schedule_interval=None,
            schedule_unit=None,
            completion_mode=CompletionMode.PER_CHILD,
            assignment_mode=AssignmentMode.STATIC,
        )
        session.add(available_chore)
        session.flush()

        parent_user = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT,
            child_id=None,
        )
        parent_admin_user = User(
            household_id=household.id,
            email="admin@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT_ADMIN,
            child_id=None,
        )
        child_user = User(
            household_id=household.id,
            email="child@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.CHILD,
            child_id=first_child.id,
        )
        session.add_all([parent_user, parent_admin_user, child_user])
        session.flush()

        submission = Submission(
            household_id=household.id,
            child_id=first_child.id,
            for_date=target_date,
            status=SubmissionStatus.PENDING,
        )
        session.add(submission)
        session.flush()

        submission_item = SubmissionItem(
            submission_id=submission.id,
            chore_id=chore.id,
            status=SubmissionStatus.PENDING,
        )
        session.add(submission_item)
        session.commit()

        return {
            "household_id": household.id,
            "target_date": target_date.isoformat(),
            "first_child_id": first_child.id,
            "second_child_id": second_child.id,
            "chore_id": chore.id,
            "available_chore_id": available_chore.id,
            "submission_id": submission.id,
            "submission_item_id": submission_item.id,
        }


def _login(client: TestClient, email: str, password: str = "password123") -> str:
    response = client.post("/chore-api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    csrf_token = response.cookies.get(CSRF_COOKIE_NAME)
    assert csrf_token is not None
    return csrf_token


def test_protected_endpoint_rejects_anonymous_requests(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    data = _seed_household_with_users()

    with TestClient(app) as client:
        response = client.get(f"/chore-api/children?household_id={data['household_id']}")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."


def test_child_role_is_forbidden_from_parent_only_endpoints(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    data = _seed_household_with_users()

    with TestClient(app) as client:
        csrf_token = _login(client, email="child@example.com")

        list_children_response = client.get(f"/chore-api/children?household_id={data['household_id']}")
        list_submissions_response = client.get("/chore-api/submissions")
        approve_response = client.post(
            f"/chore-api/submissions/{data['submission_id']}/approve-all",
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        decide_response = client.post(
            f"/chore-api/submissions/{data['submission_id']}/items/{data['submission_item_id']}/decision",
            json={"status": "APPROVED"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )

    assert list_children_response.status_code == 403
    assert list_children_response.json()["detail"] == "Forbidden."
    assert list_submissions_response.status_code == 403
    assert list_submissions_response.json()["detail"] == "Forbidden."
    assert approve_response.status_code == 403
    assert approve_response.json()["detail"] == "Forbidden."
    assert decide_response.status_code == 403
    assert decide_response.json()["detail"] == "Forbidden."


def test_parent_and_parent_admin_can_access_parent_only_endpoints(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    data = _seed_household_with_users()

    with TestClient(app) as client:
        _login(client, email="parent@example.com")
        parent_list_response = client.get(f"/chore-api/children?household_id={data['household_id']}")
        assert parent_list_response.status_code == 200

        _login(client, email="admin@example.com")
        admin_list_response = client.get(f"/chore-api/children?household_id={data['household_id']}")

    assert admin_list_response.status_code == 200


def test_child_role_can_access_child_endpoints_for_own_identity_only(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    data = _seed_household_with_users()

    with TestClient(app) as client:
        child_csrf_token = _login(client, email="child@example.com")

        own_eligible_response = client.get(
            f"/chore-api/children/me/eligible-chores?date={data['target_date']}"
        )
        other_child_eligible_response = client.get(
            f"/chore-api/children/me/eligible-chores?date={data['target_date']}&child_id={data['second_child_id']}"
        )
        own_submit_response = client.post(
            "/chore-api/submissions",
            json={"for_date": data["target_date"], "chore_ids": [data["available_chore_id"]]},
            headers={CSRF_HEADER_NAME: child_csrf_token},
        )
        other_child_submit_response = client.post(
            f"/chore-api/submissions?child_id={data['second_child_id']}",
            json={"for_date": data["target_date"], "chore_ids": [data["chore_id"]]},
            headers={CSRF_HEADER_NAME: child_csrf_token},
        )

    assert own_eligible_response.status_code == 200
    assert own_submit_response.status_code == 201
    assert own_submit_response.json()["child_id"] == data["first_child_id"]

    assert other_child_eligible_response.status_code == 403
    assert other_child_eligible_response.json()["detail"] == "Forbidden."
    assert other_child_submit_response.status_code == 403
    assert other_child_submit_response.json()["detail"] == "Forbidden."
