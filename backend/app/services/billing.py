from __future__ import annotations

from datetime import UTC, datetime
import json
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.billing import BillingAccount, BillingEvent, HouseholdEntitlement, Subscription
from app.models.enums import EntitlementStatus


def account_for_household(session: Session, household_id: int) -> BillingAccount:
    account = session.scalar(select(BillingAccount).where(BillingAccount.household_id == household_id))
    if account is None:
        account = BillingAccount(household_id=household_id, public_id=str(uuid.uuid4()))
        session.add(account)
        session.flush()
    return account


def entitlement_for_household(session: Session, household_id: int) -> HouseholdEntitlement:
    entitlement = session.get(HouseholdEntitlement, household_id)
    if entitlement is None:
        account = account_for_household(session, household_id)
        entitlement = HouseholdEntitlement(household_id=household_id, billing_account_id=account.id, status=EntitlementStatus.NONE)
        session.add(entitlement)
        session.flush()
    return entitlement


def apply_event(
    session: Session,
    *,
    household_id: int,
    source: str,
    idempotency_key: str,
    event_type: str,
    occurred_at: datetime,
    status: EntitlementStatus,
    valid_until: datetime | None,
    payload: dict[str, object],
) -> tuple[BillingEvent, HouseholdEntitlement, bool]:
    existing = session.scalar(select(BillingEvent).where(BillingEvent.source == source, BillingEvent.idempotency_key == idempotency_key))
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    if existing is not None:
        if existing.household_id != household_id or existing.event_type != event_type or existing.payload_json != canonical:
            raise ValueError("Idempotency key was already used for a different event.")
        return existing, entitlement_for_household(session, household_id), True
    account = account_for_household(session, household_id)
    event = BillingEvent(billing_account_id=account.id, household_id=household_id, source=source, idempotency_key=idempotency_key, event_type=event_type, occurred_at=occurred_at, payload_json=canonical)
    try:
        with session.begin_nested():
            session.add(event)
            session.flush()
    except IntegrityError:
        session.expire_all()
        winner = session.scalar(select(BillingEvent).where(BillingEvent.source == source, BillingEvent.idempotency_key == idempotency_key))
        if winner is None:
            raise
        if winner.household_id != household_id or winner.event_type != event_type or winner.payload_json != canonical:
            raise ValueError("Idempotency key was already used for a different event.")
        return winner, entitlement_for_household(session, household_id), True
    entitlement = entitlement_for_household(session, household_id)
    projected_at = entitlement.projected_occurred_at
    if projected_at is not None and projected_at.tzinfo is None:
        projected_at = projected_at.replace(tzinfo=UTC)
    if projected_at is None or occurred_at >= projected_at:
        if status == EntitlementStatus.COMPLIMENTARY and entitlement.valid_until is not None and valid_until is not None:
            current = entitlement.valid_until if entitlement.valid_until.tzinfo else entitlement.valid_until.replace(tzinfo=UTC)
            valid_until = max(current, valid_until)
        entitlement.status = status
        entitlement.valid_until = valid_until
        entitlement.projected_event_id = event.id
        entitlement.projected_occurred_at = occurred_at
        subscription = session.scalar(select(Subscription).where(Subscription.billing_account_id == account.id))
        if subscription is None:
            subscription = Subscription(billing_account_id=account.id, plan_key=entitlement.plan_key, status=status)
            session.add(subscription)
        subscription.plan_key = entitlement.plan_key
        subscription.status = status
        subscription.current_period_end = valid_until
    session.flush()
    return event, entitlement, False
