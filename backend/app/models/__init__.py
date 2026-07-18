from app.models.billing import BillingAccount, BillingEvent, HouseholdEntitlement, Subscription
from app.models.core import ALL_MODELS as CORE_MODELS
from app.models.platform import PlatformAuditEvent, PlatformSession, PlatformUser, SupportCase, SupportCaseNote

ALL_MODELS = CORE_MODELS + (
    PlatformUser,
    PlatformSession,
    PlatformAuditEvent,
    SupportCase,
    SupportCaseNote,
    BillingAccount,
    Subscription,
    BillingEvent,
    HouseholdEntitlement,
)

__all__ = ["ALL_MODELS"]
