from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.main import app
from app.models.core import (
    Child,
    Chore,
    Household,
    Notification,
    NotificationDeliveryAttempt,
    NotificationPreference,
    PushSubscription,
    User,
)
from app.models.enums import AssignmentMode, CompletionMode, ScheduleMode, UserRole
from app.security import hash_password
from app.security.csrf import CSRF_HEADER_NAME


def _configure(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'notification-hardening.db'}")
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("PUSH_VAPID_PUBLIC_KEY", "public")
    monkeypatch.setenv("PUSH_VAPID_PRIVATE_KEY", "private")
    get_settings.cache_clear()


def _seed(*, timezone: str = "UTC") -> dict[str, object]:
    settings = get_settings()
    initialize_database(settings)
    factory = get_session_factory(settings.database_url)
    with factory() as session:
        household = Household(name="Home", timezone=timezone)
        session.add(household)
        session.flush()
        child = Child(household_id=household.id, name="Riley", active=True)
        session.add(child)
        session.flush()
        parent = User(
            household_id=household.id,
            email="parent-hardening@example.test",
            password_hash=hash_password("password123"),
            role=UserRole.PARENT,
        )
        child_user = User(
            household_id=household.id,
            email="child-hardening@example.test",
            password_hash=hash_password("password123"),
            role=UserRole.CHILD,
            child_id=child.id,
        )
        chore = Chore(
            household_id=household.id,
            name="Dishes",
            reward_cents=100,
            start_date=date(2026, 7, 14),
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
            "parent_email": parent.email,
            "chore_id": chore.id,
            "factory": factory,
        }


def _public_dns(*_args, **_kwargs):
    return [(2, 1, 6, "", ("93.184.216.34", 443))]


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://push.example.test/sub",
        "ftp://push.example.test/sub",
        "https://localhost/sub",
        "https://127.0.0.1/sub",
        "https://[::1]/sub",
        "https://10.0.0.1/sub",
        "https://172.16.0.1/sub",
        "https://192.168.1.1/sub",
        "https://169.254.169.254/latest/meta-data",
        "https://224.0.0.1/sub",
        "https://0.0.0.0/sub",
        "https://240.0.0.1/sub",
    ],
)
def test_push_endpoint_validator_rejects_non_public_destinations(endpoint: str) -> None:
    from app.security.outbound_urls import UnsafeOutboundUrl, validate_outbound_url

    with pytest.raises(UnsafeOutboundUrl):
        validate_outbound_url(endpoint, allowed_schemes={"https"})


def test_push_endpoint_validator_rejects_dns_resolved_private_address(monkeypatch) -> None:
    from app.security.outbound_urls import UnsafeOutboundUrl, validate_outbound_url

    monkeypatch.setattr("app.security.outbound_urls.socket.getaddrinfo", lambda *_a, **_k: [(2, 1, 6, "", ("192.168.50.2", 443))])

    with pytest.raises(UnsafeOutboundUrl):
        validate_outbound_url("https://fcm.googleapis.com/sub", allowed_schemes={"https"})


def test_push_endpoint_validator_allows_only_known_browser_push_services(monkeypatch) -> None:
    from app.security.outbound_urls import UnsafeOutboundUrl, validate_push_endpoint

    monkeypatch.setattr("app.security.outbound_urls.socket.getaddrinfo", _public_dns)
    assert validate_push_endpoint("https://fcm.googleapis.com/fcm/send/sub") == "https://fcm.googleapis.com/fcm/send/sub"
    with pytest.raises(UnsafeOutboundUrl):
        validate_push_endpoint("https://attacker.example.com/collect")


def test_push_subscription_api_rejects_unsafe_endpoint_before_persisting(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed()
    with TestClient(app) as client:
        login = client.post("/chore-api/auth/login", json={"email": seed["parent_email"], "password": "password123"})
        response = client.post(
            "/chore-api/push/subscriptions",
            headers={CSRF_HEADER_NAME: login.json()["csrf_token"]},
            json={"endpoint": "https://169.254.169.254/push", "keys": {"p256dh": "p", "auth": "a"}},
        )
    assert response.status_code == 400
    with seed["factory"]() as session:
        assert session.scalar(select(PushSubscription)) is None


def test_notification_creation_only_enqueues_and_does_not_send_network(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed()
    monkeypatch.setattr("socket.getaddrinfo", _public_dns)
    from app.services.notifications import create_notification, update_user_notification_settings, upsert_push_subscription

    with seed["factory"]() as session:
        update_user_notification_settings(session, seed["parent_id"], "chores", {"push_enabled": True})
        upsert_push_subscription(
            session,
            user_id=seed["parent_id"],
            endpoint="https://fcm.googleapis.com/sub",
            p256dh="p",
            auth="a",
            device_label="browser",
        )
        notification = create_notification(
            session,
            household_id=seed["household_id"],
            user_id=seed["parent_id"],
            category="general",
            title="Queued",
            body="No request-time network",
            dedup_key="queue-only",
        )
        session.commit()
        assert notification is not None
        attempts = list(session.scalars(select(NotificationDeliveryAttempt)).all())
        assert len(attempts) == 1
        assert attempts[0].status == "pending"
        assert attempts[0].channel.startswith("push:")


def test_worker_revalidates_endpoint_uses_bounded_timeout_and_never_resends_sent_delivery(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed()
    monkeypatch.setattr("socket.getaddrinfo", _public_dns)
    from app.services.notifications import create_notification, process_pending_push_deliveries, update_user_notification_settings, upsert_push_subscription

    with seed["factory"]() as session:
        update_user_notification_settings(session, seed["parent_id"], "chores", {"push_enabled": True, "quiet_hours_start": "", "quiet_hours_end": ""})
        upsert_push_subscription(session, user_id=seed["parent_id"], endpoint="https://fcm.googleapis.com/sub", p256dh="p", auth="a", device_label="browser")
        create_notification(session, household_id=seed["household_id"], user_id=seed["parent_id"], category="general", title="Send", body="once", dedup_key="once")
        session.commit()

    calls: list[dict[str, object]] = []

    def sender(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(status_code=201)

    now = datetime(2026, 7, 14, 12, 0, tzinfo=UTC)
    assert process_pending_push_deliveries(limit=10, now=now, sender=sender) == {"sent": 1}
    assert process_pending_push_deliveries(limit=10, now=now, sender=sender) == {}
    assert len(calls) == 1
    assert calls[0]["timeout"] <= 5
    assert calls[0]["allow_redirects"] is False


def test_worker_rejects_subscription_owned_by_different_user(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed()
    monkeypatch.setattr("socket.getaddrinfo", _public_dns)
    from app.services.notifications import process_pending_push_deliveries, upsert_push_subscription

    with seed["factory"]() as session:
        subscription = upsert_push_subscription(
            session,
            user_id=seed["child_user_id"],
            endpoint="https://fcm.googleapis.com/child-sub",
            p256dh="p",
            auth="a",
            device_label="child-browser",
        )
        notification = Notification(
            household_id=seed["household_id"],
            user_id=seed["parent_id"],
            module_key="chores",
            category="general",
            severity="info",
            title="Private parent notification",
            body="Do not send to child",
            link_url="/chore/",
            in_app_visible=True,
            created_at=datetime(2026, 7, 14, 12, 0),
        )
        session.add(notification)
        session.flush()
        session.add(
            NotificationDeliveryAttempt(
                notification_id=notification.id,
                channel=f"push:{subscription.id}",
                status="pending",
                attempted_at=datetime(2026, 7, 14, 12, 0),
                error_message="",
            )
        )
        session.commit()

    calls: list[dict[str, object]] = []

    def sender(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(status_code=201)

    result = process_pending_push_deliveries(
        limit=10, now=datetime(2026, 7, 14, 12, 1, tzinfo=UTC), sender=sender
    )

    assert result == {"dead": 1}
    assert calls == []


def test_worker_reclaims_only_stale_processing_leases(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed()
    monkeypatch.setattr("socket.getaddrinfo", _public_dns)
    from app.services.notifications import create_notification, process_pending_push_deliveries, update_user_notification_settings, upsert_push_subscription

    claimed_at = datetime(2026, 7, 14, 12, 0, tzinfo=UTC)
    with seed["factory"]() as session:
        update_user_notification_settings(session, seed["parent_id"], "chores", {"push_enabled": True, "quiet_hours_start": "", "quiet_hours_end": ""})
        upsert_push_subscription(session, user_id=seed["parent_id"], endpoint="https://fcm.googleapis.com/lease", p256dh="p", auth="a", device_label="browser")
        created = create_notification(session, household_id=seed["household_id"], user_id=seed["parent_id"], category="general", title="Lease", body="lease", dedup_key="lease")
        session.commit()
        assert created is not None
        attempt = session.scalar(select(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.notification_id == created.id))
        assert attempt is not None
        attempt.status = "processing"
        attempt.attempted_at = claimed_at.replace(tzinfo=None)
        session.commit()

    calls: list[dict[str, object]] = []
    sender = lambda **kwargs: calls.append(kwargs) or SimpleNamespace(status_code=201)
    assert process_pending_push_deliveries(now=claimed_at + timedelta(minutes=4), sender=sender) == {}
    assert process_pending_push_deliveries(now=claimed_at + timedelta(minutes=5), sender=sender) == {"sent": 1}
    assert len(calls) == 1


def test_worker_disables_gone_subscription_and_retries_transient_failures_to_dead(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed()
    monkeypatch.setattr("socket.getaddrinfo", _public_dns)
    from app.services.notifications import create_notification, process_pending_push_deliveries, update_user_notification_settings, upsert_push_subscription

    with seed["factory"]() as session:
        update_user_notification_settings(session, seed["parent_id"], "chores", {"push_enabled": True, "quiet_hours_start": "", "quiet_hours_end": ""})
        subscription = upsert_push_subscription(session, user_id=seed["parent_id"], endpoint="https://fcm.googleapis.com/sub", p256dh="p", auth="a", device_label="browser")
        create_notification(session, household_id=seed["household_id"], user_id=seed["parent_id"], category="general", title="Gone", body="gone", dedup_key="gone")
        session.commit()
        subscription_id = subscription.id

    class GoneError(Exception):
        response = SimpleNamespace(status_code=410)

    now = datetime(2026, 7, 14, 12, 0, tzinfo=UTC)
    assert process_pending_push_deliveries(limit=1, now=now, sender=lambda **_kwargs: (_ for _ in ()).throw(GoneError())) == {"disabled": 1}
    with seed["factory"]() as session:
        assert session.get(PushSubscription, subscription_id).enabled is False
        assert session.scalars(select(NotificationDeliveryAttempt).order_by(NotificationDeliveryAttempt.id)).all()[-1].status == "disabled"

    # Re-enable with a new endpoint and prove bounded retries become dead.
    with seed["factory"]() as session:
        upsert_push_subscription(session, user_id=seed["parent_id"], endpoint="https://fcm.googleapis.com/second", p256dh="p", auth="a", device_label="browser")
        create_notification(session, household_id=seed["household_id"], user_id=seed["parent_id"], category="general", title="Retry", body="retry", dedup_key="retry")
        session.commit()
    failing = lambda **_kwargs: (_ for _ in ()).throw(TimeoutError("bounded timeout"))
    assert process_pending_push_deliveries(limit=10, now=now, sender=failing) == {"retry": 1}
    assert process_pending_push_deliveries(limit=10, now=now + timedelta(minutes=2), sender=failing) == {"retry": 1}
    assert process_pending_push_deliveries(limit=10, now=now + timedelta(minutes=10), sender=failing) == {"dead": 1}


def test_approval_in_app_and_push_preferences_are_enforced(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed()
    monkeypatch.setattr("socket.getaddrinfo", _public_dns)
    from app.services.notifications import create_notification, update_user_notification_settings, upsert_push_subscription

    with seed["factory"]() as session:
        update_user_notification_settings(session, seed["parent_id"], "chores", {"approval_notifications_enabled": False})
        assert create_notification(session, household_id=seed["household_id"], user_id=seed["parent_id"], category="approval", title="No", body="No") is None
        update_user_notification_settings(session, seed["parent_id"], "chores", {"approval_notifications_enabled": True, "in_app_enabled": False, "push_enabled": False})
        assert create_notification(session, household_id=seed["household_id"], user_id=seed["parent_id"], category="general", title="No", body="No") is None
        upsert_push_subscription(
            session,
            user_id=seed["parent_id"],
            endpoint="https://fcm.googleapis.com/preference",
            p256dh="p",
            auth="a",
            device_label="browser",
        )
        update_user_notification_settings(session, seed["parent_id"], "chores", {"in_app_enabled": False, "push_enabled": True})
        push_only = create_notification(
            session,
            household_id=seed["household_id"],
            user_id=seed["parent_id"],
            category="general",
            title="Push only",
            body="Hidden from inbox",
            dedup_key="push-only",
        )
        session.commit()
        assert push_only is not None
        assert push_only.in_app_visible is False
        assert session.scalar(
            select(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.notification_id == push_only.id)
        ) is not None

    with TestClient(app) as client:
        login = client.post("/chore-api/auth/login", json={"email": seed["parent_email"], "password": "password123"})
        assert login.status_code == 200
        inbox = client.get("/chore-api/notifications")
        assert inbox.status_code == 200
        assert all(item["title"] != "Push only" for item in inbox.json()["items"])


def test_scheduler_respects_household_local_digest_time_due_soon_and_is_idempotent(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed(timezone="America/New_York")
    from app.services.notifications import run_notification_scheduler, update_user_notification_settings

    with seed["factory"]() as session:
        update_user_notification_settings(
            session,
            seed["child_user_id"],
            "chores",
            {"daily_digest_enabled": True, "daily_digest_time": "08:00", "due_soon_enabled": True, "due_soon_hours": 24},
        )

    # 11:59 UTC is 07:59 local: due-soon may run, daily digest must not.
    first = run_notification_scheduler(now=datetime(2026, 7, 14, 11, 59, tzinfo=UTC))
    second = run_notification_scheduler(now=datetime(2026, 7, 14, 12, 1, tzinfo=UTC))
    third = run_notification_scheduler(now=datetime(2026, 7, 14, 12, 5, tzinfo=UTC))
    assert first == {"due_soon": 1}
    assert second == {"daily_digest": 1}
    assert third == {}

    with seed["factory"]() as session:
        keys = set(session.scalars(select(Notification.dedup_key)).all())
        assert f"chores:due-soon:{seed['child_user_id']}:2026-07-15" in keys
        assert f"chores:daily:{seed['child_user_id']}:2026-07-14" in keys


def test_worker_defers_push_during_local_quiet_hours(tmp_path: Path, monkeypatch) -> None:
    _configure(tmp_path, monkeypatch)
    seed = _seed(timezone="America/New_York")
    monkeypatch.setattr("socket.getaddrinfo", _public_dns)
    from app.services.notifications import create_notification, process_pending_push_deliveries, update_user_notification_settings, upsert_push_subscription

    with seed["factory"]() as session:
        update_user_notification_settings(session, seed["parent_id"], "chores", {"push_enabled": True, "quiet_hours_start": "21:00", "quiet_hours_end": "07:00"})
        upsert_push_subscription(session, user_id=seed["parent_id"], endpoint="https://fcm.googleapis.com/sub", p256dh="p", auth="a", device_label="browser")
        create_notification(session, household_id=seed["household_id"], user_id=seed["parent_id"], category="general", title="Quiet", body="defer", dedup_key="quiet")
        session.commit()

    sender = pytest.fail
    assert process_pending_push_deliveries(limit=10, now=datetime(2026, 7, 15, 2, 0, tzinfo=UTC), sender=sender) == {"retry": 1}
    with seed["factory"]() as session:
        queued = session.scalars(select(NotificationDeliveryAttempt).order_by(NotificationDeliveryAttempt.id.desc())).first()
        assert queued.status == "retry"
        assert queued.attempted_at == datetime(2026, 7, 15, 11, 0)
