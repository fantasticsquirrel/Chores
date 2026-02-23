from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import get_settings
from app.db import get_session_factory
from app.main import app
from app.models.core import Child, Chore, CompletionRecord, Household, Transaction
from app.models.enums import AssignmentMode, CompletionStatus, CompletionMode, ScheduleMode, TransactionType


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
        create_child_response = client.post(
            "/chore-api/children",
            json={"household_id": household_id, "name": "Riley", "active": True},
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
        )
        assert submit_response.status_code == 201
        submission_id = submit_response.json()["id"]
        assert submit_response.json()["status"] == "PENDING"
        assert submit_response.json()["items"] == [{"chore_id": chore_id, "status": "PENDING"}]

        approve_response = client.post(f"/chore-api/submissions/{submission_id}/approve-all")
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
