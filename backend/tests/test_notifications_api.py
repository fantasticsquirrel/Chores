from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import Child, Chore, Household, Notification, User
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, UserRole
from app.security import hash_password
from app.security.csrf import CSRF_HEADER_NAME


def _configure_test_settings(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "notifications.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("PUSH_VAPID_PUBLIC_KEY", "test-vapid-public-key")
    get_settings.cache_clear()


def _seed_household() -> dict[str, int | str]:
    settings = get_settings()
    initialize_database(settings)
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        household = Household(name="Home", timezone="UTC")
        session.add(household)
        session.flush()
        child = Child(household_id=household.id, name="Riley", active=True)
        session.add(child)
        session.flush()
        parent = User(
            household_id=household.id,
            email="parent@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT,
            child_id=None,
        )
        child_user = User(
            household_id=household.id,
            email="child@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.CHILD,
            child_id=child.id,
        )
        chore = Chore(
            household_id=household.id,
            name="Dishes",
            reward_cents=350,
            start_date=date(2026, 6, 18),
            schedule_mode=ScheduleMode.NONE,
            completion_mode=CompletionMode.PER_CHILD,
            assignment_mode=AssignmentMode.STATIC,
        )
        session.add_all([parent, child_user, chore])
        session.commit()
        return {
            "household_id": household.id,
            "child_id": child.id,
            "parent_id": parent.id,
            "child_user_id": child_user.id,
            "chore_id": chore.id,
            "parent_email": parent.email,
            "child_email": child_user.email,
        }


def _login(client: TestClient, email: str) -> str:
    response = client.post("/chore-api/auth/login", json={"email": email, "password": "password123"})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_notification_inbox_settings_and_push_subscription(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    monkeypatch.setattr("socket.getaddrinfo", lambda *_a, **_k: [(2, 1, 6, "", ("93.184.216.34", 443))])
    seed = _seed_household()

    with TestClient(app) as client:
        csrf = _login(client, str(seed["parent_email"]))

        empty = client.get("/chore-api/notifications")
        assert empty.status_code == 200
        assert empty.json() == {"items": [], "unread_count": 0}

        settings = client.get("/chore-api/notification-settings")
        assert settings.status_code == 200
        assert settings.json()["chores"]["in_app_enabled"] is True
        assert settings.json()["chores"]["push_enabled"] is False
        assert settings.json()["chores"]["daily_digest_enabled"] is True

        updated = client.put(
            "/chore-api/notification-settings/chores",
            headers={CSRF_HEADER_NAME: csrf},
            json={"push_enabled": True, "daily_digest_time": "07:30", "quiet_hours_start": "21:00"},
        )
        assert updated.status_code == 200
        assert updated.json()["settings"]["push_enabled"] is True
        assert updated.json()["settings"]["daily_digest_time"] == "07:30"

        push_config = client.get("/chore-api/push/config")
        assert push_config.status_code == 200
        assert push_config.json() == {"vapid_public_key": "test-vapid-public-key"}

        subscription = client.post(
            "/chore-api/push/subscriptions",
            headers={CSRF_HEADER_NAME: csrf},
            json={
                "endpoint": "https://fcm.googleapis.com/sub/1",
                "keys": {"p256dh": "p256", "auth": "auth"},
                "device_label": "Test Browser",
            },
        )
        assert subscription.status_code == 201
        assert subscription.json()["endpoint"] == "https://fcm.googleapis.com/sub/1"
        assert subscription.json()["enabled"] is True

        disabled = client.delete("/chore-api/push/subscriptions", headers={CSRF_HEADER_NAME: csrf})
        assert disabled.status_code == 204


def test_submission_and_approval_create_chore_notifications(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    seed = _seed_household()

    with TestClient(app) as client:
        child_csrf = _login(client, str(seed["child_email"]))
        submit_response = client.post(
            "/chore-api/submissions",
            headers={CSRF_HEADER_NAME: child_csrf},
            json={"for_date": "2026-06-18", "chore_ids": [seed["chore_id"]]},
        )
        assert submit_response.status_code == 201
        submission_id = submit_response.json()["id"]

        parent_csrf = _login(client, str(seed["parent_email"]))
        parent_inbox = client.get("/chore-api/notifications?unread=1")
        assert parent_inbox.status_code == 200
        assert parent_inbox.json()["unread_count"] == 1
        assert parent_inbox.json()["items"][0]["title"] == "Chore ready for review"
        assert parent_inbox.json()["items"][0]["link_url"] == "/chore/board"
        assert "Riley submitted 1 chore" in parent_inbox.json()["items"][0]["body"]

        approval = client.post(f"/chore-api/submissions/{submission_id}/approve-all", headers={CSRF_HEADER_NAME: parent_csrf})
        assert approval.status_code == 200

        _login(client, str(seed["child_email"]))
        child_inbox = client.get("/chore-api/notifications?unread=1")
        assert child_inbox.status_code == 200
        assert child_inbox.json()["unread_count"] == 1
        assert child_inbox.json()["items"][0]["title"] == "Chore approved"
        assert child_inbox.json()["items"][0]["link_url"] == "/chore/child/today"
        assert "Dishes" in child_inbox.json()["items"][0]["body"]


def test_generate_daily_chore_reminders_dedupes_per_child_date(tmp_path: Path, monkeypatch) -> None:
    _configure_test_settings(tmp_path, monkeypatch)
    seed = _seed_household()

    from app.services.notifications import generate_daily_chore_reminders

    created_first = generate_daily_chore_reminders(date(2026, 6, 18))
    created_second = generate_daily_chore_reminders(date(2026, 6, 18))

    assert created_first == 1
    assert created_second == 0

    settings = get_settings()
    session_factory = get_session_factory(settings.database_url)
    with session_factory() as session:
        notification = session.scalars(select(Notification)).one()
        assert notification.user_id == seed["child_user_id"]
        assert notification.title == "Today's chores are ready"
        assert "Dishes" in notification.body
        assert notification.dedup_key == f"chores:daily:{seed['child_user_id']}:2026-06-18"
