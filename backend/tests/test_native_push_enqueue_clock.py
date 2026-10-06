"""Enqueue must sample expiry after policy reads, per subscription."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import AuthSession, NativePushSubscription, NotificationDeliveryAttempt
from app.services import native_push_delivery as native
from app.services.modules import ModuleService
from test_native_push_delivery import NOW, make, queue  # noqa: F401


@pytest.mark.parametrize("boundary", ["session", "notification", "later_subscription"])
def test_enqueue_checks_fresh_expiry_after_policy_reads(queue, monkeypatch, boundary):
    class Clock(datetime):
        current = NOW

        @classmethod
        def now(cls, tz=None):
            return cls.current

    monkeypatch.setattr(native, "datetime", Clock)
    with queue["factory"]() as db:
        if boundary == "session":
            db.get(AuthSession, queue["auth_id"]).expires_at = NOW + timedelta(seconds=30)
        elif boundary == "later_subscription":
            auth = AuthSession(user_id=queue["parent_id"], token_hash="e" * 64,
                               expires_at=NOW + timedelta(seconds=30))
            db.add(auth)
            db.flush()
            db.add(NativePushSubscription(user_id=queue["parent_id"], household_id=queue["household_id"],
                session_id=auth.id, token="ExpoPushToken[second_offline_fixture]", platform="android",
                enabled=True, last_seen_at=NOW))
        db.commit()
    original = ModuleService.can_access_module

    def slow_policy(self, *args, **kwargs):
        allowed = original(self, *args, **kwargs)
        Clock.current += timedelta(minutes=1)
        return allowed

    monkeypatch.setattr(ModuleService, "can_access_module", slow_policy)
    if boundary == "notification":
        # Keep the production creator and its real enqueue boundary; only set
        # the notification expiry immediately before the boundary receives it.
        original_enqueue = native.enqueue_native_push_delivery_attempts

        def expiring_event(db, notification):
            notification.expires_at = NOW + timedelta(seconds=30)
            original_enqueue(db, notification)

        monkeypatch.setattr(native, "enqueue_native_push_delivery_attempts", expiring_event)
    make(queue)
    with queue["factory"]() as db:
        rows = db.scalars(select(NotificationDeliveryAttempt).where(
            NotificationDeliveryAttempt.channel.like("native:%"))).all()
        assert len(rows) == (1 if boundary == "later_subscription" else 0)
        if rows:
            assert rows[0].channel == f"native:{queue['sub_id']}"
            assert rows[0].attempted_at >= (NOW + timedelta(minutes=1)).replace(tzinfo=None)
