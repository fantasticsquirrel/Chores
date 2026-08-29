import type { ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { SubscriptionCard } from "../features/account/components/SubscriptionCard";
import { AccountSecurityPage } from "./AccountSecurityPage";
import { ThemePicker } from "../theme";
import { Card } from "../ui";

export function AccountPage(): ReactElement {
  const { user } = useAuth();
  return (
    <div className="account-grid">
      <Card as="section" className="appearance-card">
        <p className="eyebrow">Personalize</p>
        <h1>Appearance</h1>
        <p>Choose the visual style for this device. Your selection is saved automatically.</p>
        <ThemePicker />
      </Card>
      <AccountSecurityPage />
      {user?.is_household_owner === true ? <SubscriptionCard /> : null}
    </div>
  );
}
