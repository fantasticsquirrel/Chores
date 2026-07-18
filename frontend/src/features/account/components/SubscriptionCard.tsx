import { useEffect, useState, type ReactElement } from "react";

import { apiClient } from "../../../api";
import type { BillingStatus, BillingStatusResponse } from "../../../api/models";
import { formatApiError } from "../../../lib/errors";
import { Button, Card, InlineNotice } from "../../../ui";

const statusLabels: Record<BillingStatus, string> = {
  none: "No subscription",
  trialing: "Trial access",
  active: "Active subscription",
  grace_period: "Grace period",
  billing_retry: "Payment retry needed",
  canceled_active: "Canceled — access remains active",
  expired: "Subscription expired",
  refunded: "Subscription refunded",
  revoked: "Access revoked",
  complimentary: "Complimentary access",
};

export function SubscriptionCard(): ReactElement {
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient.getBillingStatus().then((value) => {
      if (active) setBilling(value);
    }).catch((loadError: unknown) => {
      if (active) setError(formatApiError(loadError));
    });
    return () => { active = false; };
  }, []);

  async function performAction(action: string): Promise<void> {
    setPendingAction(action);
    setError(null);
    setMessage(null);
    try {
      const response = await apiClient.performBillingAction({ action });
      setMessage(response.message);
      if (response.redirect_url) window.location.assign(response.redirect_url);
    } catch (actionError: unknown) {
      setError(formatApiError(actionError));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Card as="section" className="subscription-card">
      <h2>Subscription</h2>
      {billing === null && error === null ? <p role="status">Loading subscription…</p> : null}
      {error !== null ? <InlineNotice variant="error">Could not load subscription: {error}</InlineNotice> : null}
      {billing !== null ? (
        <>
          <p><strong>{statusLabels[billing.status]}</strong></p>
          {billing.plan_name ? <p>Plan: {billing.plan_name}</p> : null}
          {billing.expires_at ? <p>Access expires {formatDate(billing.expires_at)}.</p> : null}
          {!billing.expires_at && billing.current_period_ends_at ? <p>Current period ends {formatDate(billing.current_period_ends_at)}.</p> : null}
          {billing.provider === null ? <p>No payment provider is connected.</p> : null}
          {billing.available_actions.length === 0 ? <p>No subscription actions are currently available.</p> : (
            <div className="subscription-actions" aria-label="Subscription actions">
              {billing.available_actions.map((action) => (
                <Button key={action.key} type="button" disabled={pendingAction !== null} onClick={() => void performAction(action.key)}>
                  {pendingAction === action.key ? "Working…" : action.label}
                </Button>
              ))}
            </div>
          )}
        </>
      ) : null}
      {message !== null ? <InlineNotice variant="info">{message}</InlineNotice> : null}
    </Card>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}
