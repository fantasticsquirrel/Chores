from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_roles
from app.models.core import Household, User
from app.models.enums import UserRole
from app.schemas.platform import BillingStatusResponse
from app.services.billing import entitlement_for_household

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("", response_model=BillingStatusResponse)
def read_billing(
    session: Session = Depends(get_db_session),
    user: User = Depends(require_roles(UserRole.PARENT_ADMIN, UserRole.PARENT)),
) -> BillingStatusResponse:
    household = session.get(Household, user.household_id)
    if household is None or household.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Household owner access required.")
    entitlement = entitlement_for_household(session, user.household_id)
    from app.models.billing import BillingAccount

    billing_account = session.get(BillingAccount, entitlement.billing_account_id)
    session.commit()
    return BillingStatusResponse(
        household_id=user.household_id,
        billing_account_id=billing_account.public_id,  # type: ignore[union-attr]
        plan_key=entitlement.plan_key,
        status=entitlement.status,
        plan_name=(
            "Family Plus"
            if entitlement.status.value != "none"
            else None
        ),
        expires_at=entitlement.valid_until,
        available_actions=[],
    )
