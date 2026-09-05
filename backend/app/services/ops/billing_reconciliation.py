"""Privileged household billing inspection and reconciliation operations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session

from app.models.billing import BillingEvent, HouseholdEntitlement
from app.models.enums import EntitlementStatus
from app.models.identity import Household, User
from app.models.platform import SupportCase
from app.services.billing import apply_event, entitlement_for_household
from app.services.ops.platform_users import redact_email
from app.services.ops.support_cases import (
    get_open_household_support_case_or_403,
    list_household_support_cases,
    support_case_dict,
)


@dataclass(frozen=True)
class ComplimentaryGrant:
    household: Household
    event: BillingEvent
    entitlement: HouseholdEntitlement
    replay: bool
    expires_at: datetime


@dataclass(frozen=True)
class BillingReconciliation:
    household: Household
    case: SupportCase
    entitlement: HouseholdEntitlement


def get_household_or_404(session: Session, household_id: int) -> Household:
    household = session.scalar(
        select(Household).where(Household.id == household_id)
    )
    if household is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household not found.",
        )
    return household


def search_households(
    session: Session,
    query: str,
) -> list[dict[str, object]]:
    normalized = query.strip().lower()
    households = session.scalars(
        select(Household)
        .outerjoin(User, User.id == Household.owner_user_id)
        .where(
            or_(
                Household.name.ilike(f"%{normalized}%"),
                User.email.ilike(f"%{normalized}%"),
                cast(Household.id, String) == normalized,
            )
        )
        .order_by(Household.id)
        .limit(50)
    ).all()
    return [household_summary_dict(session, household) for household in households]


def household_summary_dict(
    session: Session,
    household: Household,
) -> dict[str, object]:
    owner = (
        session.scalar(select(User).where(User.id == household.owner_user_id))
        if household.owner_user_id
        else None
    )
    entitlement = entitlement_for_household(session, household.id)
    return {
        "id": household.id,
        "name": household.name,
        "owner_email": redact_email(owner.email) if owner else "***",
        "billing_status": entitlement.status.value,
    }


def household_detail(
    session: Session,
    household_id: int,
) -> dict[str, object]:
    household = get_household_or_404(session, household_id)
    owner = (
        session.scalar(select(User).where(User.id == household.owner_user_id))
        if household.owner_user_id
        else None
    )
    owner_email = redact_email(owner.email) if owner else "***"
    entitlement = entitlement_for_household(session, household.id)
    return {
        "id": household.id,
        "name": household.name,
        "owner_email": owner_email,
        "billing_status": entitlement.status.value,
        "ownership": {
            "household_id": household.id,
            "owner_user_id": household.owner_user_id,
            "owner_email": owner_email,
        },
        "billing": billing_status_dict(entitlement),
        "entitlements": [
            {
                "key": entitlement.plan_key,
                "status": entitlement.status.value,
                "expires_at": entitlement.valid_until,
            }
        ],
        "support_cases": [
            support_case_dict(session, case, include_household_id=False)
            for case in list_household_support_cases(session, household.id)
        ],
    }


def billing_status_dict(
    entitlement: HouseholdEntitlement,
) -> dict[str, object]:
    return {
        "status": entitlement.status.value,
        "provider": None,
        "plan_name": (
            "Family Plus" if entitlement.status != EntitlementStatus.NONE else None
        ),
        "expires_at": entitlement.valid_until,
        "current_period_ends_at": None,
        "available_actions": [],
    }


def list_household_billing_events(
    session: Session,
    household_id: int,
) -> list[dict[str, object]]:
    events = session.scalars(
        select(BillingEvent)
        .where(BillingEvent.household_id == household_id)
        .order_by(BillingEvent.id.desc())
        .limit(100)
    ).all()
    return [
        {
            "id": str(event.id),
            "type": event.event_type,
            "occurred_at": event.occurred_at,
            "summary": event.event_type.replace(".", " "),
        }
        for event in events
    ]


def household_billing_detail(
    session: Session,
    household_id: int,
) -> dict[str, object]:
    get_household_or_404(session, household_id)
    entitlement = entitlement_for_household(session, household_id)
    events = session.scalars(
        select(BillingEvent)
        .where(BillingEvent.household_id == household_id)
        .order_by(BillingEvent.id.desc())
        .limit(100)
    ).all()
    return {
        "household_id": household_id,
        "entitlement": {
            "plan_key": entitlement.plan_key,
            "status": entitlement.status.value,
            "valid_until": entitlement.valid_until,
        },
        "events": [
            {
                "id": event.id,
                "source": event.source,
                "event_type": event.event_type,
                "occurred_at": event.occurred_at,
            }
            for event in events
        ],
    }


def grant_complimentary_entitlement(
    session: Session,
    *,
    household_id: int,
    expires_at: datetime,
    reason: str,
    idempotency_key: str,
    now: datetime | None = None,
) -> ComplimentaryGrant:
    household = get_household_or_404(session, household_id)
    expiry = _aware(expires_at)
    occurred_at = now or datetime.now(UTC)
    if expiry <= occurred_at or expiry > occurred_at + timedelta(days=3660):
        raise HTTPException(
            status_code=422,
            detail="Complimentary expiry must be finite and in the future.",
        )
    event, entitlement, replay = apply_event(
        session,
        household_id=household_id,
        source="platform",
        idempotency_key=idempotency_key,
        event_type="complimentary.granted",
        occurred_at=occurred_at,
        status=EntitlementStatus.COMPLIMENTARY,
        valid_until=expiry,
        payload={
            "expires_at": expiry.isoformat(),
            "reason": reason,
            "plan_key": "family_plus",
        },
    )
    return ComplimentaryGrant(
        household=household,
        event=event,
        entitlement=entitlement,
        replay=replay,
        expires_at=expiry,
    )


def reconcile_household_billing(
    session: Session,
    *,
    household_id: int,
    case_id: int,
) -> BillingReconciliation:
    case = get_open_household_support_case_or_403(
        session,
        case_id=case_id,
        household_id=household_id,
    )
    household = get_household_or_404(session, household_id)
    entitlement = entitlement_for_household(session, household_id)
    return BillingReconciliation(
        household=household,
        case=case,
        entitlement=entitlement,
    )


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)
