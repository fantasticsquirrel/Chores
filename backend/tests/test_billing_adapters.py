from __future__ import annotations

import pytest

from app.services.billing_adapters import BillingProviderDisabled, get_billing_adapter


@pytest.mark.parametrize("provider", ["stripe", "revenuecat", "google_play"])
def test_external_billing_adapters_are_explicitly_disabled_without_credentials(provider: str) -> None:
    adapter = get_billing_adapter(provider)
    assert adapter.enabled is False
    with pytest.raises(BillingProviderDisabled, match="not configured"):
        adapter.start_checkout(household_id=1, plan_key="family_plus")


def test_unknown_billing_provider_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported billing provider"):
        get_billing_adapter("invented")
