from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import get_settings
from app.db import get_session_factory
from app.main import app
from app.models.core import Child, Chore, CompletionRecord, Household, Transaction, User
from app.models.enums import AssignmentMode, CompletionStatus, CompletionMode, ScheduleMode, TransactionType, UserRole
from app.security import hash_password
from app.security.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "happy_path_e2e.db"
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


def _create_child_user(
    household_id: int,
    child_id: int,
    email: str = "child@example.com",
    password: str = "password123",
) -> str:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        user = User(
            household_id=household_id,
            email=email.lower(),
            password_hash=hash_password(password),
            role=UserRole.CHILD,
            child_id=child_id,
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


def _create_chore(household_id: int, target_date: date) -> int:
    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        chore = Chore(
            household_id=household_id,
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
        session.commit()
        return chore.id


def test_happy_path_create_submit_approve_updates_balance(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    target_date = date(2026, 2, 23)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        create_child_response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert create_child_response.status_code == 201
        child_id = create_child_response.json()["id"]

        chore_id = _create_chore(household_id, target_date)

        eligible_response = client.get(
            f"/chore-api/children/me/eligible-chores?date={target_date.isoformat()}&child_id={child_id}"
        )
        assert eligible_response.status_code == 200
        assert eligible_response.json() == [
            {
                "chore_id": chore_id,
                "name": "Dishes",
                "reward_cents": 350,
                "occurrence_date": target_date.isoformat(),
                "expires_on": None,
            }
        ]

        submit_response = client.post(
            f"/chore-api/submissions?child_id={child_id}",
            json={"for_date": target_date.isoformat(), "chore_ids": [chore_id]},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert submit_response.status_code == 201
        submission_id = submit_response.json()["id"]
        assert submit_response.json()["status"] == "PENDING"
        assert submit_response.json()["items"] == [{"chore_id": chore_id, "status": "PENDING"}]

        approve_response = client.post(
            f"/chore-api/submissions/{submission_id}/approve-all",
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert approve_response.status_code == 200
        assert approve_response.json()["status"] == "APPROVED"
        assert approve_response.json()["items"][0]["status"] == "APPROVED"

        eligible_after_approval = client.get(
            f"/chore-api/children/me/eligible-chores?date={target_date.isoformat()}&child_id={child_id}"
        )
        assert eligible_after_approval.status_code == 200
        assert eligible_after_approval.json() == []

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        child = session.get(Child, child_id)
        assert child is not None

        total_balance_cents = session.scalar(
            select(func.coalesce(func.sum(Transaction.amount_cents), 0)).where(Transaction.child_id == child.id)
        )
        assert total_balance_cents == 350

        completion_record = session.scalars(
            select(CompletionRecord).where(
                CompletionRecord.child_id == child.id,
                CompletionRecord.chore_id == chore_id,
                CompletionRecord.date == target_date,
                CompletionRecord.status == CompletionStatus.APPROVED,
            )
        ).one_or_none()
        assert completion_record is not None

        transaction = session.scalars(
            select(Transaction).where(
                Transaction.child_id == child.id,
                Transaction.type == TransactionType.CHORE_APPROVAL,
                Transaction.amount_cents == 350,
            )
        ).one_or_none()
        assert transaction is not None


def test_child_session_can_load_eligible_chores_and_submit(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    target_date = date(2026, 2, 23)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        parent_csrf_token = _login_parent(client)
        create_child_response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
            headers={CSRF_HEADER_NAME: parent_csrf_token},
        )
        assert create_child_response.status_code == 201
        child_id = create_child_response.json()["id"]

        _create_chore(household_id, target_date)
        child_password = _create_child_user(household_id, child_id)

        child_login_response = client.post(
            "/chore-api/auth/login",
            json={"email": "child@example.com", "password": child_password},
        )
        assert child_login_response.status_code == 200
        child_csrf_token = child_login_response.cookies.get(CSRF_COOKIE_NAME)
        assert child_csrf_token is not None

        eligible_response = client.get(f"/chore-api/children/me/eligible-chores?date={target_date.isoformat()}")
        assert eligible_response.status_code == 200
        eligible_payload = eligible_response.json()
        assert len(eligible_payload) == 1
        chore_id = eligible_payload[0]["chore_id"]

        submit_response = client.post(
            "/chore-api/submissions",
            json={"for_date": target_date.isoformat(), "chore_ids": [chore_id]},
            headers={CSRF_HEADER_NAME: child_csrf_token},
        )
        assert submit_response.status_code == 201
        assert submit_response.json()["child_id"] == child_id
        assert submit_response.json()["status"] == "PENDING"
        assert submit_response.json()["items"] == [{"chore_id": chore_id, "status": "PENDING"}]


def test_parent_can_decide_submission_items_individually(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    target_date = date(2026, 2, 23)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        create_child_response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert create_child_response.status_code == 201
        child_id = create_child_response.json()["id"]

        first_chore_id = _create_chore(household_id, target_date)
        second_chore_id = _create_chore(household_id, target_date)
        submit_response = client.post(
            f"/chore-api/submissions?child_id={child_id}",
            json={"for_date": target_date.isoformat(), "chore_ids": [first_chore_id, second_chore_id]},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert submit_response.status_code == 201
        submission_id = submit_response.json()["id"]

        submissions_response = client.get("/chore-api/submissions?status=PENDING")
        assert submissions_response.status_code == 200
        submission_items = submissions_response.json()[0]["items"]
        first_item_id = next(item["id"] for item in submission_items if item["chore_id"] == first_chore_id)
        second_item_id = next(item["id"] for item in submission_items if item["chore_id"] == second_chore_id)

        reject_response = client.post(
            f"/chore-api/submissions/{submission_id}/items/{first_item_id}/decision",
            json={"status": "REJECTED"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert reject_response.status_code == 200
        reject_payload = reject_response.json()
        assert reject_payload["status"] == "PENDING"
        assert next(item for item in reject_payload["items"] if item["id"] == first_item_id)["status"] == "REJECTED"

        approve_response = client.post(
            f"/chore-api/submissions/{submission_id}/items/{second_item_id}/decision",
            json={"status": "APPROVED"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert approve_response.status_code == 200
        approve_payload = approve_response.json()
        assert approve_payload["status"] == "APPROVED"
        assert next(item for item in approve_payload["items"] if item["id"] == second_item_id)["status"] == "APPROVED"

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        total_balance_cents = session.scalar(
            select(func.coalesce(func.sum(Transaction.amount_cents), 0)).where(Transaction.child_id == child_id)
        )
        assert total_balance_cents == 350


def test_parent_rejecting_submission_item_marks_submission_rejected_without_balance_credit(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    target_date = date(2026, 2, 23)

    with TestClient(app) as client:
        household_id = _create_household()
        _create_parent_user(household_id)
        csrf_token = _login_parent(client)
        create_child_response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert create_child_response.status_code == 201
        child_id = create_child_response.json()["id"]

        chore_id = _create_chore(household_id, target_date)
        submit_response = client.post(
            f"/chore-api/submissions?child_id={child_id}",
            json={"for_date": target_date.isoformat(), "chore_ids": [chore_id]},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert submit_response.status_code == 201
        submission_id = submit_response.json()["id"]

        submissions_response = client.get("/chore-api/submissions?status=PENDING")
        assert submissions_response.status_code == 200
        item_id = submissions_response.json()[0]["items"][0]["id"]

        reject_response = client.post(
            f"/chore-api/submissions/{submission_id}/items/{item_id}/decision",
            json={"status": "REJECTED"},
            headers={CSRF_HEADER_NAME: csrf_token},
        )
        assert reject_response.status_code == 200
        reject_payload = reject_response.json()
        assert reject_payload["status"] == "REJECTED"
        assert reject_payload["items"] == [
            {
                "id": item_id,
                "chore_id": chore_id,
                "chore_name": "Dishes",
                "chore_reward_cents": 350,
                "status": "REJECTED",
            }
        ]

        pending_after_rejection_response = client.get("/chore-api/submissions?status=PENDING")
        assert pending_after_rejection_response.status_code == 200
        assert pending_after_rejection_response.json() == []

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        total_balance_cents = session.scalar(
            select(func.coalesce(func.sum(Transaction.amount_cents), 0)).where(Transaction.child_id == child_id)
        )
        assert total_balance_cents == 0

        credit_transaction = session.scalars(
            select(Transaction).where(
                Transaction.child_id == child_id,
                Transaction.type == TransactionType.CHORE_APPROVAL,
            )
        ).one_or_none()
        assert credit_transaction is None
