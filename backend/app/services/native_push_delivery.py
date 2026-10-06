"""Session-bound native outbox. Provider acceptance is not device delivery."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
import json
import re
from typing import Any, Callable

from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AuthSession, Household, NativePushSubscription, Notification, NotificationDeliveryAttempt, User
from app.services.modules import ModuleService
from app.services.native_push_subscriptions import bound_session_valid, db_time
from app.services.notification_preferences import get_user_notification_settings, quiet_hours_end

SEND_URL = "https://exp.host/--/api/v2/push/send"
RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts"
MAX_RESPONSE_BYTES = 64 * 1024
MAX_SENDS = 3
MAX_RECEIPTS = 6
LEASE = timedelta(minutes=5)
_TICKET = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_TOKEN = re.compile(r"(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{1,200}\]\Z")


def enqueue_native_push_delivery_attempts(session: Session, notification: Notification) -> None:
    """Persist in the notification transaction; never perform request-time I/O."""
    from app.config import get_settings

    if not get_settings().native_push_enabled:
        return
    subscriptions = session.scalars(select(NativePushSubscription).where(
        NativePushSubscription.user_id == notification.user_id,
        NativePushSubscription.household_id == notification.household_id,
        NativePushSubscription.enabled.is_(True),
    )).all()
    for sub in subscriptions:
        user = session.get(User, sub.user_id)
        if (user is None or not user.active
            or sub.user_id != notification.user_id
            or sub.household_id != notification.household_id or user.household_id != notification.household_id
            or session.get(Household, notification.household_id) is None
            or not _TOKEN.fullmatch(sub.token)
            or not ModuleService().can_access_module(session, user, notification.module_key)):
            continue
        preferences = get_user_notification_settings(session, user.id).get(notification.module_key, {})
        if (preferences.get("push_enabled") is not True
            or notification.category == "approval" and preferences.get("approval_notifications_enabled") is False):
            continue
        channel = f"native:{sub.id}"
        if session.scalar(select(NotificationDeliveryAttempt.id).where(
            NotificationDeliveryAttempt.notification_id == notification.id,
            NotificationDeliveryAttempt.channel == channel,
        )) is not None:
            continue
        try:
            with session.begin_nested():
                auth = session.get(AuthSession, sub.session_id)
                # Selection, policy/prefs, deduplication and savepoint reads
                # can take time. Sample per binding immediately before insert.
                now = datetime.now(UTC)
                if (not bound_session_valid(session, auth, user, now)
                    or notification.expires_at is not None and db_time(notification.expires_at) <= db_time(now)):
                    continue
                session.add(NotificationDeliveryAttempt(
                    notification_id=notification.id, channel=channel, status="pending",
                    attempted_at=db_time(now), error_message=json.dumps({"session_id": sub.session_id, "sends": 0, "receipts": 0}),
                ))
                session.flush()
        except IntegrityError:
            # The unique (notification, channel) key is authoritative under races.
            pass


def _provider_request(*, url: str, json: dict[str, Any], timeout: int, allow_redirects: bool) -> dict[str, Any]:
    import requests
    from app.config import get_settings

    if url not in {SEND_URL, RECEIPT_URL}:
        raise ValueError("invalid provider destination")
    headers = {"Accept": "application/json"}
    access = get_settings().native_push_access_token
    if access:
        headers["Authorization"] = f"Bearer {access}"
    try:
        with requests.post(url, json=json, headers=headers, timeout=5, allow_redirects=False, stream=True) as response:
            if not 200 <= response.status_code < 300:
                raise ValueError("invalid provider response")
            body = bytearray()
            for chunk in response.iter_content(chunk_size=8192):
                if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                    raise ValueError("invalid provider response")
                body.extend(chunk)
            import json as codec
            decoded = codec.loads(body)
            if not isinstance(decoded, dict):
                raise ValueError("invalid provider response")
            return decoded
    except Exception:
        # Never propagate provider payloads, request objects, or credentials.
        raise ValueError("invalid provider response") from None


def _eligible_attempts(clock: datetime):
    return or_(
        and_(NotificationDeliveryAttempt.status.in_(["pending", "retry", "accepted"]), NotificationDeliveryAttempt.attempted_at <= clock),
        and_(NotificationDeliveryAttempt.status.in_(["processing", "receipt_processing"]), NotificationDeliveryAttempt.attempted_at <= clock - LEASE),
    )


def process_pending_native_push_deliveries(
    *, limit: int = 100, now: datetime | None = None,
    sender: Callable[..., Any] = _provider_request,
    receipt_reader: Callable[..., Any] = _provider_request,
) -> dict[str, int]:
    from app.config import get_settings
    from app.db import get_session_factory

    settings = get_settings()
    if not settings.native_push_enabled or limit <= 0:
        return {}
    current = now if now is not None else datetime.now(UTC)
    clock = db_time(current)
    factory = get_session_factory(settings.database_url)
    counts: dict[str, int] = {}
    with factory() as session:
        ids = list(session.scalars(select(NotificationDeliveryAttempt.id).where(
            NotificationDeliveryAttempt.channel.like("native:%"), _eligible_attempts(clock),
        ).order_by(NotificationDeliveryAttempt.id).limit(min(limit, 100))).all())
        session.commit()
        for attempt_id in ids:
            session.expire_all()
            attempt = session.get(NotificationDeliveryAttempt, attempt_id)
            if attempt is None:
                continue
            old_status, old_time, old_meta = attempt.status, attempt.attempted_at, attempt.error_message
            try:
                meta = json.loads(old_meta)
                if not isinstance(meta, dict) or any(type(meta.get(k)) is not int or meta[k] < 0 for k in ("session_id", "sends", "receipts")):
                    raise ValueError
                meta = {k: meta[k] for k in ("session_id", "sends", "receipts")} | ({"ticket": meta["ticket"]} if "ticket" in meta else {})
                if "ticket" in meta and (not isinstance(meta["ticket"], str) or not _TICKET.fullmatch(meta["ticket"])):
                    raise ValueError
                valid_meta = True
            except (ValueError, TypeError, KeyError):
                meta = {"session_id": 0, "sends": 0, "receipts": 0}
                valid_meta = False
            receipt = old_status in {"accepted", "receipt_processing"}
            key, maximum = ("receipts", MAX_RECEIPTS) if receipt else ("sends", MAX_SENDS)
            exhausted = meta[key] >= maximum
            # Persist the consumed provider budget before I/O; crash recovery is bounded.
            if valid_meta and not exhausted:
                meta[key] += 1
            claimed_meta = json.dumps(meta, sort_keys=True)
            processing = "receipt_processing" if receipt else "processing"
            # Batch selection is only a snapshot. Eligibility and lease ownership
            # use the actual claim time, not time consumed by earlier rows.
            claim_clock = db_time(now if now is not None else datetime.now(UTC))
            claimed = session.execute(update(NotificationDeliveryAttempt).where(
                NotificationDeliveryAttempt.id == attempt_id,
                NotificationDeliveryAttempt.channel.like("native:%"), _eligible_attempts(claim_clock),
                NotificationDeliveryAttempt.status == old_status,
                NotificationDeliveryAttempt.attempted_at == old_time,
                NotificationDeliveryAttempt.error_message == old_meta,
            ).values(status=processing, attempted_at=claim_clock, error_message=claimed_meta), execution_options={"synchronize_session": False})
            session.commit()
            if claimed.rowcount != 1:
                continue
            reason = "invalid_queue" if not valid_meta else "budget_exhausted"
            notification = session.get(Notification, attempt.notification_id)
            try:
                sid = int(attempt.channel.removeprefix("native:"))
            except ValueError:
                sid = 0
            sub = session.get(NativePushSubscription, sid)
            user = session.get(User, notification.user_id) if notification else None
            household = session.get(Household, notification.household_id) if notification else None
            allowed = bool(valid_meta and not exhausted and notification and sub and user and household and sub.enabled
                and user.active and sub.user_id == notification.user_id
                and sub.household_id == notification.household_id == user.household_id
                and sub.session_id == meta["session_id"]
                and _TOKEN.fullmatch(sub.token)
                and ModuleService().can_access_module(session, user, notification.module_key))
            preferences = get_user_notification_settings(session, user.id).get(notification.module_key, {}) if user else {}
            allowed = allowed and preferences.get("push_enabled") is True and not (notification.category == "approval" and preferences.get("approval_notifications_enabled") is False)
            auth = session.get(AuthSession, sub.session_id) if allowed else None
            # Recheck time-sensitive policy after claim/policy reads, before I/O.
            current = now if now is not None else datetime.now(UTC)
            clock = db_time(current)
            status, due = "dead", clock
            allowed = allowed and bound_session_valid(session, auth, user, current)
            if valid_meta and not exhausted and not allowed:
                status, reason = "disabled", "policy_disabled"
            elif allowed and notification.expires_at and db_time(notification.expires_at) <= clock:
                status, reason = "expired", "notification_expired"
            elif allowed:
                quiet_until = quiet_hours_end(current, household.timezone, preferences)
                if quiet_until is not None:
                    meta[key] -= 1  # quiet hours are not a provider attempt
                    status, due, reason = ("accepted" if receipt else "retry"), db_time(quiet_until), "quiet_hours"
                else:
                    # Release DB transaction before a bounded provider call.
                    token, binding = sub.token, sub.session_id
                    session.commit()
                    try:
                        if receipt:
                            ticket = meta.get("ticket")
                            if not ticket:
                                raise ValueError("invalid queue receipt")
                            response = receipt_reader(url=RECEIPT_URL, json={"ids": [ticket]}, timeout=5, allow_redirects=False)
                            item = response.get("data", {}).get(ticket)
                        else:
                            response = sender(url=SEND_URL, json={"to": token, "title": "Family Manager", "body": "You have a new notification.", "channelId": "household", "data": {"notification_id": notification.id}}, timeout=5, allow_redirects=False)
                            data = response.get("data")
                            item = data if isinstance(data, dict) else data[0] if isinstance(data, list) and len(data) == 1 else None
                        # Retry/receipt delays start after this provider call,
                        # while the final CAS retains the exact claim timestamp.
                        clock = db_time(now if now is not None else datetime.now(UTC))
                        due = clock
                        if isinstance(item, dict) and item.get("status") == "ok":
                            if receipt:
                                status, reason = "provider_delivered", "receipt_ok"
                            else:
                                ticket = item.get("id")
                                if not isinstance(ticket, str) or not _TICKET.fullmatch(ticket):
                                    raise ValueError("invalid ticket")
                                meta["ticket"] = ticket
                                status, due, reason = "accepted", clock + timedelta(minutes=15), "ticket_accepted"
                        elif isinstance(item, dict) and item.get("status") == "error":
                            details = item.get("details")
                            code = details.get("error") if isinstance(details, dict) else None
                            if code == "DeviceNotRegistered":
                                session.execute(update(NativePushSubscription).where(
                                    NativePushSubscription.id == sid, NativePushSubscription.session_id == binding,
                                    NativePushSubscription.user_id == notification.user_id, NativePushSubscription.token == token,
                                ).values(enabled=False, disabled_at=clock), execution_options={"synchronize_session": False})
                                status, reason = "disabled", "device_not_registered"
                            elif code in {"MessageTooBig", "MismatchSenderId", "InvalidCredentials"}:
                                status, reason = "dead", "provider_rejected"
                            else:
                                raise ValueError("provider retry")
                        else:
                            raise ValueError("provider pending")
                    except Exception:
                        clock = db_time(now if now is not None else datetime.now(UTC))
                        status = "dead" if meta[key] >= maximum else ("accepted" if receipt else "retry")
                        due = clock + timedelta(minutes=min(30, 2 ** (2 * meta[key] - 1)))
                        reason = "provider_unavailable" if not receipt else "receipt_pending"
            meta["reason"] = reason
            # A stale lease owner must never overwrite a newer worker's result.
            finished = session.execute(update(NotificationDeliveryAttempt).where(
                NotificationDeliveryAttempt.id == attempt_id,
                NotificationDeliveryAttempt.status == processing,
                NotificationDeliveryAttempt.attempted_at == claim_clock,
                NotificationDeliveryAttempt.error_message == claimed_meta,
            ).values(status=status, attempted_at=due, error_message=json.dumps(meta, sort_keys=True)), execution_options={"synchronize_session": False})
            session.commit()
            if finished.rowcount == 1:
                counts[status] = counts.get(status, 0) + 1
    return counts
