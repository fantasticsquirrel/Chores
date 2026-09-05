import { TextInput, View } from "react-native";

import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { InlineNotice } from "../../../components/InlineNotice";
import { SectionCard } from "../../../components/SectionCard";
import { formStyles } from "../../../styles/forms";
import type { UseChildAccountActionsResult } from "../hooks/useChildAccountActions";

export function ChildAccountPanels({
  actions,
  childrenAvailable,
}: {
  actions: UseChildAccountActionsResult;
  childrenAvailable: boolean;
}) {
  return (
    <>
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
          placeholderTextColor="#94a3b8"
          style={formStyles.input}
          value={actions.linkAccount.email}
        />
        <FieldLabel label="Temporary Password" />
        <TextInput
          onChangeText={actions.linkAccount.setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor="#94a3b8"
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
          />
        </View>
        {actions.linkAccount.error !== null ? (
          <InlineNotice tone="error" message={actions.linkAccount.error} />
        ) : null}
        {actions.linkAccount.success !== null ? (
          <InlineNotice tone="success" message={actions.linkAccount.success} />
        ) : null}
      </SectionCard>

      <SectionCard
        subtitle="Leave blank to generate a new internal legacy email."
        title="Reset Legacy Login Email"
      >
        <FieldLabel label="New Legacy Login Email (optional)" />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={actions.resetEmail.setEmail}
          placeholder="Leave blank to auto-generate"
          placeholderTextColor="#94a3b8"
          style={formStyles.input}
          value={actions.resetEmail.email}
        />
        <View style={formStyles.inlineButtons}>
          <ActionButton
            compact
            disabled={actions.resetEmail.submitting || !childrenAvailable}
            label={
              actions.resetEmail.submitting ? "Resetting..." : "Reset Email"
            }
            onPress={actions.resetEmail.submit}
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

      <SectionCard
        subtitle="Sets a temporary password for the selected child account."
        title="Reset Child Password"
      >
        <FieldLabel label="New Temporary Password" />
        <TextInput
          onChangeText={actions.resetPassword.setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={formStyles.input}
          textContentType="newPassword"
          value={actions.resetPassword.password}
        />
        <FieldLabel label="Confirm Temporary Password" />
        <TextInput
          onChangeText={actions.resetPassword.setConfirmation}
          placeholder="Repeat temporary password"
          placeholderTextColor="#94a3b8"
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
                : "Reset Password"
            }
            onPress={actions.resetPassword.submit}
            variant="secondary"
          />
        </View>
        {actions.resetPassword.error !== null ? (
          <InlineNotice tone="error" message={actions.resetPassword.error} />
        ) : null}
        {actions.resetPassword.success !== null ? (
          <InlineNotice tone="success" message={actions.resetPassword.success} />
        ) : null}
      </SectionCard>
    </>
  );
}
