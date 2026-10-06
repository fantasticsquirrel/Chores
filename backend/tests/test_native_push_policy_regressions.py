"""Native enqueue and advancing runtime-clock regressions; offline providers only."""
from datetime import datetime, timedelta
import json

import pytest
from sqlalchemy import select

from app.models import AuthSession, Household, Module, NativePushSubscription, Notification, NotificationDeliveryAttempt, User
from app.services.modules import ModuleService
from app.services.native_push_delivery import enqueue_native_push_delivery_attempts
from app.services.native_push_subscriptions import db_time
from app.services.notification_creation import create_notification as emit_notification
from app.services.notification_preferences import update_user_notification_settings
from test_native_push_delivery import NOW, accepted, make, queue, row, run


@pytest.mark.parametrize("grant", ["global", "household", "user"])
def test_durable_creation_does_not_enqueue_denied_module_then_restore(queue, grant):
    service = ModuleService()
    with queue["factory"]() as db:
        user = db.get(User, queue["parent_id"])
        if grant == "global":
            db.get(Module, "chores").enabled = False
        elif grant == "household":
            service.set_household_access(db, household_id=user.household_id, module_key="chores", enabled=False)
        else:
            service.set_user_access(db, user, "chores", can_view=False)
        db.commit()
        assert not service.can_access_module(db, user, "chores")
        notification = emit_notification(db, household_id=user.household_id, user_id=user.id,
                                         category="general", title="Offline fixture", body="")
        db.commit()
        notification_id = notification.id
        queued = list(db.scalars(select(NotificationDeliveryAttempt)).all())
        if grant == "global":
            db.get(Module, "chores").enabled = True
        elif grant == "household":
            service.set_household_access(db, household_id=user.household_id, module_key="chores", enabled=True)
        else:
            service.set_user_access(db, user, "chores", can_view=True)
        db.commit()
        assert db.get(Notification, notification_id) is not None
        assert service.can_access_module(db, user, "chores")
    calls = []
    result = run(now=NOW, sender=lambda **kw: calls.append(kw) or accepted())
    assert queued == [], "denied creation must not persist a native outbox row"
    assert calls == [] and result == {}


@pytest.mark.parametrize("denial", ["prefs", "approval", "household", "session_actor", "expired_notification"])
def test_direct_enqueue_applies_notification_policy(queue, denial):
    with queue["factory"]() as db:
        user = db.get(User, queue["parent_id"])
        category = "approval" if denial == "approval" else "general"
        if denial in {"prefs", "approval"}:
            update_user_notification_settings(db, user.id, "chores", {
                "push_enabled" if denial == "prefs" else "approval_notifications_enabled": False,
            })
        elif denial == "household":
            other = Household(name="Other", timezone="UTC")
            db.add(other)
            db.flush()
            user.household_id = other.id
        elif denial == "session_actor":
            db.get(AuthSession, queue["auth_id"]).user_id = queue["child_user_id"]
        notification = Notification(household_id=queue["household_id"], user_id=user.id,
                                    module_key="chores", category=category, title="Offline fixture", body="",
                                    expires_at=datetime(2000, 1, 1) if denial == "expired_notification" else None)
        db.add(notification)
        db.flush()
        enqueue_native_push_delivery_attempts(db, notification)
        db.commit()
        assert list(db.scalars(select(NotificationDeliveryAttempt)).all()) == []


@pytest.mark.parametrize("grant", ["global", "household", "user"])
def test_worker_still_rechecks_module_grants_after_enqueue(queue, grant):
    make(queue)
    with queue["factory"]() as db:
        user = db.get(User, queue["parent_id"])
        if grant == "global":
            db.get(Module, "chores").enabled = False
        elif grant == "household":
            ModuleService().set_household_access(db, household_id=user.household_id, module_key="chores", enabled=False)
        else:
            ModuleService().set_user_access(db, user, "chores", can_view=False)
        db.commit()
    assert run(now=NOW, sender=lambda **kw: pytest.fail("denied module send")) == {"disabled": 1}


def _runtime_clock(monkeypatch):
    import app.services.native_push_delivery as worker

    class Clock(datetime):
        value = NOW

        @classmethod
        def now(cls, tz=None):
            return cls.value.astimezone(tz) if tz else cls.value.replace(tzinfo=None)

    monkeypatch.setattr(worker, "datetime", Clock)
    return Clock


def _pending_batch(queue, count):
    ids = []
    with queue["factory"]() as db:
        for _ in range(count):
            notification = Notification(household_id=queue["household_id"], user_id=queue["parent_id"],
                                        module_key="chores", title="Offline fixture", body="")
            db.add(notification)
            db.flush()
            ids.append(notification.id)
            db.add(NotificationDeliveryAttempt(notification_id=notification.id, channel=f"native:{queue['sub_id']}",
                                               status="pending", attempted_at=db_time(NOW - timedelta(seconds=1)),
                                               error_message=json.dumps({"session_id": queue["auth_id"], "sends": 0, "receipts": 0})))
        db.commit()
    return ids


@pytest.mark.parametrize("expiry", ["auth", "notification"])
def test_runtime_clock_prevents_later_row_send_after_expiry(queue, monkeypatch, expiry):
    clock = _runtime_clock(monkeypatch)
    ids = _pending_batch(queue, 2)
    with queue["factory"]() as db:
        if expiry == "auth":
            db.get(AuthSession, queue["auth_id"]).expires_at = NOW + timedelta(seconds=1)
        else:
            db.get(Notification, ids[1]).expires_at = NOW + timedelta(seconds=1)
        db.commit()
    calls = []

    def sender(**kw):
        calls.append(kw["json"]["data"]["notification_id"])
        clock.value += timedelta(seconds=2)
        return accepted()

    result = run(sender=sender)  # No now= override: exercise the production clock path.
    assert calls == [ids[0]], "later row must not send using the batch-start policy clock"
    assert result == {"accepted": 1, "disabled" if expiry == "auth" else "expired": 1}


def test_runtime_clock_claims_later_row_with_fresh_lease(queue, monkeypatch):
    clock = _runtime_clock(monkeypatch)
    ids = _pending_batch(queue, 64)
    calls, nested_results = [], []

    def nested_sender(**kw):
        calls.append(kw["json"]["data"]["notification_id"])
        return accepted()

    def sender(**kw):
        notification_id = kw["json"]["data"]["notification_id"]
        calls.append(notification_id)
        if notification_id != ids[-1]:
            clock.value += timedelta(seconds=5)  # Every earlier call fits the provider timeout.
        else:
            nested_results.append(run(sender=nested_sender))
        return accepted()

    result = run(sender=sender)
    assert calls == ids, "batch duration must not create an immediately reclaimable lease"
    assert nested_results == [{}]
    assert result == {"accepted": len(ids)}


@pytest.mark.parametrize("outcome", ["accepted", "retry", "receipt_pending"])
def test_runtime_clock_schedules_due_from_provider_completion(queue, monkeypatch, outcome):
    make(queue)
    if outcome == "receipt_pending":
        run(now=NOW, sender=accepted)
    clock = _runtime_clock(monkeypatch)
    if outcome == "receipt_pending":
        clock.value += timedelta(minutes=16)

    def provider(**kw):
        clock.value += timedelta(seconds=5)
        if outcome == "accepted":
            return accepted()
        raise ValueError("offline unavailable")

    run(sender=provider, receipt_reader=provider)
    delay = timedelta(minutes=15 if outcome == "accepted" else 2)
    assert row(queue).attempted_at == db_time(clock.value + delay)
