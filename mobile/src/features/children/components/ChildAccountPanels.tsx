import { colors } from "../../../styles/colors";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { InlineNotice } from "../../../components/InlineNotice";
import { SectionCard } from "../../../components/SectionCard";
import { formStyles } from "../../../styles/forms";
import type { UseChildAccountActionsResult } from "../hooks/useChildAccountActions";

export function ChildAccountPanels({
  actions,
  childrenAvailable,
  childName,
  hasLogin,
}: {
  actions: UseChildAccountActionsResult;
  childrenAvailable: boolean;
  childName: string;
  hasLogin?: boolean;
}) {
  const [action, setAction] = useState<"link" | "password" | "email">(
    hasLogin ? "password" : "link",
  );
  const [help, setHelp] = useState(false);
  const busy =
    actions.linkAccount.submitting ||
    actions.resetEmail.submitting ||
    actions.resetPassword.submitting;
  return (
    <>
      <SectionCard title={`${childName}’s account`}>
        <View style={formStyles.inlineButtons}>
          <ActionButton
            label="Link Child Login"
            disabled={busy}
            onPress={() => setAction("link")}
            variant="secondary"
          />
          <ActionButton
            label="Reset Password"
            disabled={busy}
            onPress={() => setAction("password")}
            variant="secondary"
          />
          <ActionButton
            label="Advanced account tools"
            disabled={busy}
            onPress={() => setAction("email")}
            variant="secondary"
          />
        </View>
        <ActionButton
          label="How child sign-in works"
          onPress={() => setHelp(!help)}
          variant="secondary"
        />
        {help ? (
          <Text>
            Children can sign in with a parent login email, their child name,
            and child password. Existing legacy email/password sign-ins still
            work.
          </Text>
        ) : null}
      </SectionCard>
      {action === "link" ? (
        <SectionCard
          subtitle="Kids can sign in with parent email, child name, and child password. Legacy child emails still work."
          title="Child Login"
        >
          <FieldLabel label="Legacy Login Email (optional, blank auto-generates)" />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={actions.linkAccount.setEmail}
            placeholder="kid@example.com"
            placeholderTextColor={colors.textSubtle}
            style={formStyles.input}
            value={actions.linkAccount.email}
          />
          <FieldLabel label="Temporary Password" />
          <TextInput
            onChangeText={actions.linkAccount.setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
            style={formStyles.input}
            value={actions.linkAccount.password}
          />
          <View style={formStyles.inlineButtons}>
            <ActionButton
              compact
              disabled={actions.linkAccount.submitting || !childrenAvailable}
              label={
                actions.linkAccount.submitting ? "Linking..." : "Create Login"
              }
              onPress={actions.linkAccount.submit}
              requiresManage
            />
          </View>
          {actions.linkAccount.error !== null ? (
            <InlineNotice tone="error" message={actions.linkAccount.error} />
          ) : null}
          {actions.linkAccount.success !== null ? (
            <InlineNotice
              tone="success"
              message={actions.linkAccount.success}
            />
          ) : null}
        </SectionCard>
      ) : null}

      {action === "email" ? (
        <SectionCard
          subtitle={`Changes ${childName}’s legacy email and signs out existing sessions. Leave blank to auto-generate.`}
          title="Reset Legacy Login Email"
        >
          <FieldLabel label="New Legacy Login Email (optional)" />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={actions.resetEmail.setEmail}
            placeholder="Leave blank to auto-generate"
            placeholderTextColor={colors.textSubtle}
            style={formStyles.input}
            value={actions.resetEmail.email}
          />
          <View style={formStyles.inlineButtons}>
            <ActionButton
              compact
              disabled={actions.resetEmail.submitting || !childrenAvailable}
              label={
                actions.resetEmail.submitting
                  ? "Resetting..."
                  : `Reset Email for ${childName}`
              }
              onPress={actions.resetEmail.submit}
              requiresManage
              variant="secondary"
            />
          </View>
          {actions.resetEmail.error !== null ? (
            <InlineNotice tone="error" message={actions.resetEmail.error} />
          ) : null}
          {actions.resetEmail.success !== null ? (
            <InlineNotice tone="success" message={actions.resetEmail.success} />
          ) : null}
        </SectionCard>
      ) : null}

      {action === "password" ? (
        <SectionCard
          subtitle={`Replaces ${childName}’s password and signs out existing sessions.`}
          title="Reset Child Password"
        >
          <FieldLabel label="New Temporary Password" />
          <TextInput
            onChangeText={actions.resetPassword.setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
            style={formStyles.input}
            textContentType="newPassword"
            value={actions.resetPassword.password}
          />
          <FieldLabel label="Confirm Temporary Password" />
          <TextInput
            onChangeText={actions.resetPassword.setConfirmation}
            placeholder="Repeat temporary password"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
            style={formStyles.input}
            textContentType="newPassword"
            value={actions.resetPassword.confirmation}
          />
          <View style={formStyles.inlineButtons}>
            <ActionButton
              compact
              disabled={actions.resetPassword.submitting || !childrenAvailable}
              label={
                actions.resetPassword.submitting
                  ? "Resetting..."
                  : `Reset Password for ${childName}`
              }
              onPress={actions.resetPassword.submit}
              requiresManage
              variant="secondary"
            />
          </View>
          {actions.resetPassword.error !== null ? (
            <InlineNotice tone="error" message={actions.resetPassword.error} />
          ) : null}
          {actions.resetPassword.success !== null ? (
            <InlineNotice
              tone="success"
              message={actions.resetPassword.success}
            />
          ) : null}
        </SectionCard>
      ) : null}
    </>
  );
}
