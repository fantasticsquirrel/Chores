"""Durable native push tests use real SQLite and explicit offline providers."""
from datetime import UTC, datetime, timedelta
import json

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import AuthSession, Household, Module, NativePushSubscription, Notification, NotificationDeliveryAttempt, User
from app.services.notification_creation import create_notification
from app.services.notification_preferences import update_user_notification_settings
from test_notification_hardening import _configure, _seed

NOW = datetime(2030, 1, 1, 12, tzinfo=UTC)
TOKEN = "ExpoPushToken[offline_fixture]"


@pytest.fixture
def queue(tmp_path, monkeypatch):
    _configure(tmp_path, monkeypatch)
    monkeypatch.setenv("NATIVE_PUSH_ENABLED", "true")
    monkeypatch.setenv("PUSH_VAPID_PRIVATE_KEY", "")
    get_settings.cache_clear()
    seed = _seed()
    with seed["factory"]() as db:
        from app.services.modules import ModuleService
        ModuleService().ensure_catalog(db)
        update_user_notification_settings(db, seed["parent_id"], "chores", {"push_enabled": True, "quiet_hours_start": "", "quiet_hours_end": ""})
        auth = AuthSession(user_id=seed["parent_id"], token_hash="f" * 64, expires_at=NOW + timedelta(days=2))
        db.add(auth)
        db.flush()
        sub = NativePushSubscription(user_id=seed["parent_id"], household_id=seed["household_id"], session_id=auth.id, token=TOKEN, platform="android", enabled=True, last_seen_at=NOW)
        db.add(sub)
        db.commit()
        seed.update(auth_id=auth.id, sub_id=sub.id)
    return seed


def make(queue):
    with queue["factory"]() as db:
        n = create_notification(db, household_id=queue["household_id"], user_id=queue["parent_id"], category="approval", title="PRIVATE TITLE", body="PRIVATE BODY", link_url="/private", dedup_key="native-fixture")
        db.commit()
        return n.id


def row(queue):
    with queue["factory"]() as db:
        return db.scalar(select(NotificationDeliveryAttempt))


def run(**kwargs):
    from app.services.native_push_delivery import process_pending_native_push_deliveries
    return process_pending_native_push_deliveries(**kwargs)


def accepted(**kwargs):
    return {"data": [{"status": "ok", "id": "receipt-fixture"}]}


def test_documented_single_message_ticket_shape_is_accepted(queue):
    make(queue)
    result = run(now=NOW, sender=lambda **kw: {"data": {"status": "ok", "id": "documented-single-ticket"}})
    assert result == {"accepted": 1}
    assert row(queue).status == "accepted"


def test_android_message_targets_the_channel_created_by_the_runtime(queue):
    from pathlib import Path
    import re
    runtime = Path(__file__).resolve().parents[2] / "mobile/src/features/notifications/lib/nativePushRuntime.ts"
    match = re.search(r'setNotificationChannelAsync\("([^"\n]+)"', runtime.read_text())
    assert match is not None, "native runtime must declare its notification channel"
    channel = match.group(1)
    make(queue)
    calls = []
    def sender(**kwargs):
        calls.append(kwargs)
        return accepted()
    assert run(now=NOW, sender=sender) == {"accepted": 1}
    assert calls[0]["json"].get("channelId") == channel


def test_creation_queues_native_without_vapid_and_deduplicates(queue):
    nid = make(queue)
    assert row(queue) is not None, "native queue missing when VAPID is absent"
    from app.services.native_push_delivery import enqueue_native_push_delivery_attempts
    with queue["factory"]() as db:
        enqueue_native_push_delivery_attempts(db, db.get(Notification, nid))
        db.commit()
        rows = db.scalars(select(NotificationDeliveryAttempt)).all()
        assert len(rows) == 1
        assert rows[0].channel == f"native:{queue['sub_id']}"
        assert rows[0].status == "pending"


def test_old_worker_does_not_claim_native_channels(queue):
    with queue["factory"]() as db:
        n = Notification(household_id=queue["household_id"], user_id=queue["parent_id"], title="fixture", body="fixture")
        db.add(n)
        db.flush()
        db.add(NotificationDeliveryAttempt(notification_id=n.id, channel=f"native:{queue['sub_id']}", status="pending", attempted_at=NOW, error_message=""))
        db.commit()
    from app.services.notification_push import process_pending_push_deliveries
    assert process_pending_push_deliveries(now=NOW, sender=lambda **k: pytest.fail("browser sender called")) == {}
    assert row(queue).status == "pending"


def test_ticket_is_only_accepted_then_receipt_provider_delivered(queue):
    nid = make(queue)
    calls = []
    def sender(**kw):
        calls.append(kw)
        # Reentrant worker must not claim the current live lease.
        assert run(now=NOW, sender=lambda **k: pytest.fail("duplicate claim")) == {}
        return accepted()
    assert run(now=NOW, sender=sender) == {"accepted": 1}
    assert row(queue).status == "accepted"
    assert calls[0]["url"] == "https://exp.host/--/api/v2/push/send"
    assert calls[0]["timeout"] == 5 and calls[0]["allow_redirects"] is False
    assert calls[0]["json"] == {"to": TOKEN, "title": "Family Manager", "body": "You have a new notification.", "channelId": "household", "data": {"notification_id": nid}}
    assert run(now=NOW, sender=lambda **k: pytest.fail("resend")) == {}
    receipts = []
    def reader(**kw):
        receipts.append(kw)
        return {"data": {"receipt-fixture": {"status": "ok"}}}
    assert run(now=NOW + timedelta(minutes=16), receipt_reader=reader) == {"provider_delivered": 1}
    assert receipts[0]["url"] == "https://exp.host/--/api/v2/push/getReceipts"
    assert receipts[0]["json"] == {"ids": ["receipt-fixture"]}
    assert run(now=NOW + timedelta(days=1), sender=lambda **k: pytest.fail("terminal resend")) == {}


@pytest.mark.parametrize("reason", ["revoked", "generation", "expired_session", "inactive", "household", "rebound", "module", "prefs", "approval", "expired_notification", "disabled"])
def test_worker_rechecks_authorization_and_policy_before_send(queue, reason):
    nid = make(queue)
    with queue["factory"]() as db:
        auth = db.get(AuthSession, queue["auth_id"])
        user = db.get(User, queue["parent_id"])
        sub = db.get(NativePushSubscription, queue["sub_id"])
        if reason == "revoked": auth.revoked_at = NOW
        elif reason == "generation": user.session_generation += 1
        elif reason == "expired_session": auth.expires_at = NOW
        elif reason == "inactive": user.active = False
        elif reason == "household":
            other = Household(name="Other", timezone="UTC")
            db.add(other)
            db.flush()
            sub.household_id = other.id
        elif reason == "rebound": sub.user_id = queue["child_user_id"]
        elif reason == "module": db.get(Module, "chores").enabled = False
        elif reason in {"prefs", "approval"}:
            update_user_notification_settings(db, user.id, "chores", {"push_enabled" if reason == "prefs" else "approval_notifications_enabled": False})
        elif reason == "expired_notification": db.get(Notification, nid).expires_at = NOW
        elif reason == "disabled": sub.enabled = False
        db.commit()
    result = run(now=NOW, sender=lambda **k: pytest.fail("unauthorized send"))
    assert sum(result.values()) == 1
    assert row(queue).status in {"disabled", "dead", "expired"}


def test_quiet_hours_defer_without_consuming_send_budget(queue):
    make(queue)
    with queue["factory"]() as db:
        update_user_notification_settings(db, queue["parent_id"], "chores", {"quiet_hours_start": "11:00", "quiet_hours_end": "13:00"})
    assert run(now=NOW, sender=lambda **k: pytest.fail("quiet send")) == {"retry": 1}
    assert json.loads(row(queue).error_message)["sends"] == 0
    assert run(now=NOW + timedelta(hours=2), sender=accepted) == {"accepted": 1}


def test_send_retries_bounded_and_secrets_never_persist(queue):
    make(queue)
    def broken(**kw):
        raise RuntimeError(TOKEN + " secret provider response")
    for delta in [0, 3, 20]:
        run(now=NOW + timedelta(minutes=delta), sender=broken)
    attempt = row(queue)
    assert attempt.status == "dead"
    assert json.loads(attempt.error_message)["sends"] == 3
    assert TOKEN not in attempt.error_message and "secret provider response" not in attempt.error_message


@pytest.mark.parametrize("phase", ["ticket", "receipt"])
def test_device_not_registered_disables_only_bound_subscription(queue, phase):
    make(queue)
    error = {"status": "error", "message": TOKEN, "details": {"error": "DeviceNotRegistered"}}
    if phase == "ticket":
        run(now=NOW, sender=lambda **k: {"data": [error]})
    else:
        run(now=NOW, sender=accepted)
        run(now=NOW + timedelta(minutes=16), receipt_reader=lambda **k: {"data": {"receipt-fixture": error}})
    assert row(queue).status == "disabled"
    assert TOKEN not in row(queue).error_message
    with queue["factory"]() as db:
        assert db.get(NativePushSubscription, queue["sub_id"]).enabled is False


def test_pending_receipts_are_bounded_and_never_resend(queue):
    make(queue)
    run(now=NOW, sender=accepted)
    for i in range(6):
        run(now=NOW + timedelta(hours=i + 1), receipt_reader=lambda **k: {"data": {}}, sender=lambda **k: pytest.fail("receipt resend"))
    assert row(queue).status == "dead"
    assert json.loads(row(queue).error_message)["receipts"] == 6


def test_expired_claim_is_recovered_but_live_claim_not_stolen(queue):
    make(queue)
    with queue["factory"]() as db:
        a = db.scalar(select(NotificationDeliveryAttempt))
        a.status = "processing"
        a.attempted_at = NOW.replace(tzinfo=None)
        db.commit()
    assert run(now=NOW + timedelta(minutes=1), sender=accepted) == {}
    assert run(now=NOW + timedelta(minutes=6), sender=accepted) == {"accepted": 1}


def test_disabled_native_flag_does_not_claim_existing_queue(queue, monkeypatch):
    make(queue)
    monkeypatch.setenv("NATIVE_PUSH_ENABLED", "false")
    get_settings.cache_clear()
    assert run(now=NOW, sender=lambda **k: pytest.fail("disabled feature send")) == {}
    assert row(queue).status == "pending"


def test_transport_bounds_stream_and_redacts_failure(monkeypatch):
    from app.services.native_push_delivery import _provider_request
    import requests
    seen = []
    class Response:
        status_code = 200
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def iter_content(self, chunk_size):
            yield b"x" * 65537
    def post(url, **kw):
        seen.append((url, kw))
        return Response()
    monkeypatch.setattr(requests, "post", post)
    with pytest.raises(ValueError, match="invalid provider response"):
        _provider_request(url="https://exp.host/--/api/v2/push/send", json={}, timeout=5, allow_redirects=False)
    assert seen[0][1]["stream"] is True
    assert seen[0][1]["allow_redirects"] is False


def test_script_runs_both_durable_workers(monkeypatch, capsys):
    import runpy
    from pathlib import Path
    import app.services.native_push_delivery as native
    import app.services.notification_push as browser
    calls = []
    def process(kind):
        def worker(**kw):
            calls.append((kind, kw))
            return {"accepted" if kind == "native" else "sent": 1}
        return worker
    monkeypatch.setattr(native, "process_pending_native_push_deliveries", process("native"))
    monkeypatch.setattr(browser, "process_pending_push_deliveries", process("browser"))
    runpy.run_path(str(Path(__file__).parents[1] / "scripts/process_push_deliveries.py"), run_name="__main__")
    assert json.loads(capsys.readouterr().out) == {"browser": {"sent": 1}, "native": {"accepted": 1}}
    assert calls == [("browser", {"limit": 100}), ("native", {"limit": 100})]


def test_receipt_claim_never_leaks_rebound_actor(queue):
    make(queue)
    run(now=NOW, sender=accepted)
    with queue["factory"]() as db:
        db.get(NativePushSubscription, queue["sub_id"]).user_id = queue["child_user_id"]
        db.commit()
    assert run(now=NOW + timedelta(minutes=16), receipt_reader=lambda **k: pytest.fail("rebound receipt lookup")) == {"disabled": 1}


@pytest.mark.parametrize("code", ["MessageTooBig", "MismatchSenderId", "InvalidCredentials"])
def test_terminal_provider_errors_are_dead_without_disabling_other_targets(queue, code):
    make(queue)
    assert run(now=NOW, sender=lambda **k: {"data": [{"status": "error", "details": {"error": code}}]}) == {"dead": 1}
    with queue["factory"]() as db:
        assert db.get(NativePushSubscription, queue["sub_id"]).enabled is True
