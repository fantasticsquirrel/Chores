"""Append-only platform audit creation and household-scoped presentation."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform import PlatformAuditEvent
from app.services.ops.platform_users import redacted_platform_user_email


def record_platform_audit(
    session: Session,
    event_type: str,
    *,
    actor_platform_user_id: int | None,
    household_id: int | None = None,
    reason: str = "",
    details: dict[str, object] | None = None,
) -> PlatformAuditEvent:
    event = PlatformAuditEvent(
        event_type=event_type,
        actor_platform_user_id=actor_platform_user_id,
        household_id=household_id,
        reason=reason,
        details_json=json.dumps(details or {}, sort_keys=True),
    )
    session.add(event)
    return event


def list_household_audit_events(
    session: Session,
    household_id: int,
) -> list[dict[str, object]]:
    events = session.scalars(
        select(PlatformAuditEvent)
        .where(PlatformAuditEvent.household_id == household_id)
        .order_by(PlatformAuditEvent.id.desc())
        .limit(100)
    ).all()
    return [platform_audit_event_dict(session, event) for event in events]


def platform_audit_event_dict(
    session: Session,
    event: PlatformAuditEvent,
) -> dict[str, object]:
    actor_email = (
        redacted_platform_user_email(session, event.actor_platform_user_id)
        if event.actor_platform_user_id is not None
        else "system"
    )
    return {
        "id": str(event.id),
        "actor_email": actor_email,
        "action": event.event_type,
        "occurred_at": event.created_at,
        "reason": event.reason or None,
    }
