import { useEffect, useState } from "react";
import { Text } from "react-native";

import { apiClient } from "../../api/client";
import type { BillingStatus, BillingStatusResponse } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InfoRow } from "../../components/InfoRow";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

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

export function SubscriptionScreen() {
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient.getBillingStatus().then((value) => {
      if (active) setBilling(value);
    }).catch((loadError: unknown) => {
      if (active) setError(formatError(loadError));
    });
    return () => { active = false; };
  }, []);

  async function performAction(action: string) {
    setPendingAction(action);
    setError(null);
    setMessage(null);
    try {
      const result = await apiClient.performBillingAction({ action });
      setMessage(result.message);
    } catch (actionError) {
      setError(formatError(actionError));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <SectionCard title="Subscription" subtitle="Household billing and access">
      {billing === null && error === null ? <LoadingRow label="Loading subscription" /> : null}
      {error !== null ? <InlineNotice tone="error" message={`Could not load subscription: ${error}`} /> : null}
      {billing !== null ? (
        <>
          <Text style={styles.cardTitle}>{statusLabels[billing.status]}</Text>
          {billing.plan_name !== null ? <InfoRow label="Plan" value={billing.plan_name} /> : null}
          {billing.expires_at !== null ? <InfoRow label="Access expires" value={formatDate(billing.expires_at)} /> : null}
          {billing.expires_at === null && billing.current_period_ends_at !== null ? <InfoRow label="Current period ends" value={formatDate(billing.current_period_ends_at)} /> : null}
          {billing.provider === null ? <Text style={styles.mutedText}>No payment provider is connected.</Text> : null}
          {billing.available_actions.length === 0 ? <Text style={styles.mutedText}>No subscription actions are currently available.</Text> : billing.available_actions.map((action) => (
            <ActionButton
              key={action.key}
              disabled={pendingAction !== null}
              label={pendingAction === action.key ? "Working…" : action.label}
              onPress={() => { void performAction(action.key); }}
            />
          ))}
        </>
      ) : null}
      {message !== null ? <InlineNotice tone="success" message={message} /> : null}
    </SectionCard>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}
