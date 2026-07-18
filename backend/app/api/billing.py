from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, require_roles
from app.models.core import User
from app.models.enums import UserRole
from app.schemas.platform import BillingStatusResponse
from app.services.billing import entitlement_for_household

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("", response_model=BillingStatusResponse)
def read_billing(session: Session = Depends(get_db_session), user: User = Depends(require_roles(UserRole.PARENT_ADMIN, UserRole.PARENT))) -> BillingStatusResponse:
    entitlement = entitlement_for_household(session, user.household_id)
    account = entitlement.billing_account_id
    from app.models.billing import BillingAccount
    billing_account = session.get(BillingAccount, account)
    session.commit()
    return BillingStatusResponse(household_id=user.household_id, billing_account_id=billing_account.public_id, plan_key=entitlement.plan_key, status=entitlement.status, valid_until=entitlement.valid_until)  # type: ignore[union-attr]
