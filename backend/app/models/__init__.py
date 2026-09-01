from app.models.billing import BillingAccount, BillingCustomerReference, BillingEvent, HouseholdEntitlement, Subscription
from app.models.core import ALL_MODELS as CORE_MODELS
from app.models.platform import PlatformAuditEvent, PlatformSession, PlatformUser, SupportCase, SupportCaseNote
from app.models.support import SupportTicketLink, SupportWebhookReceipt

ALL_MODELS = CORE_MODELS + (
    PlatformUser,
    PlatformSession,
    PlatformAuditEvent,
    SupportCase,
    SupportCaseNote,
    BillingAccount,
    BillingCustomerReference,
    Subscription,
    BillingEvent,
    HouseholdEntitlement,
    SupportTicketLink,
    SupportWebhookReceipt,
)

__all__ = ["ALL_MODELS"]
