import type { ReactElement } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { SubscriptionCard } from "../features/account/components/SubscriptionCard";
import { AccountSecurityPage } from "./AccountSecurityPage";
import { ThemePicker } from "../theme";
import { Button, Card } from "../ui";
import "../features/account/account-sections.css";

export function AccountPage(): ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = location.pathname.endsWith("/security") ? "security" : params.get("section");
  const section = requested === "appearance" || (requested === "subscription" && user?.is_household_owner)
    ? requested : "security";
  const sections = ["security", "appearance", ...(user?.is_household_owner ? ["subscription"] : [])];
  return (
    <div className="account-grid">
      <nav className="quick-actions" aria-label="Account sections">
        {sections.map((item) => <Button key={item} aria-pressed={section === item}
          onClick={() => navigate(item === "security" ? "/account/security" : `/account?section=${item}`)}>
          {item[0].toUpperCase() + item.slice(1)}
        </Button>)}
      </nav>
      {section === "appearance" ? <Card as="section" className="appearance-card">
        <p className="eyebrow">Personalize</p>
        <h1>Appearance</h1>
        <p>Choose the visual style for this device. Your selection is saved automatically.</p>
        <ThemePicker />
      </Card> : null}
      <div hidden={section !== "security"}><AccountSecurityPage /></div>
      {section === "subscription" && user?.is_household_owner === true ? <SubscriptionCard /> : null}
    </div>
  );
}
