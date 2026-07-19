import type { ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { SubscriptionCard } from "../features/account/components/SubscriptionCard";
import { AccountSecurityPage } from "./AccountSecurityPage";

export function AccountPage(): ReactElement {
  const { user } = useAuth();
  return (
    <div className="account-grid">
      <AccountSecurityPage />
      {user?.is_household_owner === true ? <SubscriptionCard /> : null}
    </div>
  );
}
