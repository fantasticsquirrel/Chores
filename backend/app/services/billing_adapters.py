from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class BillingProviderDisabled(RuntimeError):
    """Raised when an external billing provider has not been configured."""


class BillingAdapter(Protocol):
    @property
    def provider(self) -> str: ...

    @property
    def enabled(self) -> bool: ...

    def start_checkout(self, *, household_id: int, plan_key: str) -> str: ...


@dataclass(frozen=True, slots=True)
class DisabledBillingAdapter:
    provider: str
    enabled: bool = False

    def start_checkout(self, *, household_id: int, plan_key: str) -> str:
        del household_id, plan_key
        raise BillingProviderDisabled(
            f"Billing provider '{self.provider}' is not configured."
        )


_SUPPORTED_EXTERNAL_PROVIDERS = frozenset({"stripe", "revenuecat", "google_play"})


def get_billing_adapter(provider: str) -> BillingAdapter:
    normalized = provider.strip().lower()
    if normalized not in _SUPPORTED_EXTERNAL_PROVIDERS:
        raise ValueError(f"Unsupported billing provider: {provider}")
    return DisabledBillingAdapter(provider=normalized)
