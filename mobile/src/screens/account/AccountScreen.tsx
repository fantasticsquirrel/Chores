import { useState } from "react";
import { Text, View } from "react-native";

import type { AuthSessionResponse, FamilyModule } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { InfoRow } from "../../components/InfoRow";
import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";
import { ChangePasswordScreen } from "./ChangePasswordScreen";
import { SubscriptionScreen } from "./SubscriptionScreen";

type AccountMode = "profile" | "security" | "subscription";

export function AccountScreen({
  modules,
  onLogout,
  session,
}: {
  modules: FamilyModule[];
  onLogout: () => Promise<void>;
  session: AuthSessionResponse;
}) {
  const [mode, setMode] = useState<AccountMode>("profile");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLogout() {
    setLogoutLoading(true);
    setError(null);
    try {
      await onLogout();
    } catch (logoutError) {
      setError(`Could not log out: ${formatError(logoutError)}`);
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <View>
      <ScreenHeader subtitle="Signed-in account" title="Account" />
      <SectionCard title="View">
        <ChoiceGroup<AccountMode>
          onChange={setMode}
          options={[
            { label: "Profile", value: "profile" },
            { label: "Security", value: "security" },
            ...(session.user.is_household_owner
              ? [{ label: "Subscription", value: "subscription" as const }]
              : []),
          ]}
          value={mode}
        />
      </SectionCard>
      {mode === "security" ? <ChangePasswordScreen /> : null}
      {mode === "subscription" && session.user.is_household_owner ? <SubscriptionScreen /> : null}
      {mode === "profile" ? (
        <>
          <SectionCard title="Profile">
            <InfoRow label="Email" value={session.user.email} />
            <InfoRow label="Role" value={session.user.role.replace("_", " ")} />
            <InfoRow
              label="Household"
              value={session.user.household_id.toString()}
            />
            {session.user.child_id !== null &&
            session.user.child_id !== undefined ? (
              <InfoRow label="Child" value={session.user.child_id.toString()} />
            ) : null}
          </SectionCard>
          <SectionCard title="Modules">
            {modules.length === 0 ? (
              <Text style={styles.mutedText}>No modules loaded.</Text>
            ) : (
              modules.map((module) => (
                <InfoRow
                  key={module.key}
                  label={module.name}
                  value={module.key}
                />
              ))
            )}
          </SectionCard>
        </>
      ) : null}
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      <ActionButton
        disabled={logoutLoading}
        label={logoutLoading ? "Logging out..." : "Log out"}
        onPress={submitLogout}
        variant="danger"
      />
    </View>
  );
}
