import { useState } from "react";
import { TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import { ActionButton } from "../../components/ActionButton";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

export function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clearNotices() {
    setError(null);
    setSuccess(null);
  }

  async function submitChangePassword() {
    if (
      currentPassword.length === 0 ||
      newPassword.length === 0 ||
      confirmPassword.length === 0
    ) {
      setSuccess(null);
      setError("All password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setSuccess(null);
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSuccess(null);
      setError("New password and confirm password must match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password changed successfully.");
    } catch (changeError) {
      setError(`Could not change password: ${formatError(changeError)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Account Security">
      <View style={styles.compactStack}>
        <FieldLabel label="Current Password" />
        <TextInput
          maxLength={1024}
          onChangeText={(value) => {
            setCurrentPassword(value);
            clearNotices();
          }}
          placeholder="Current password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          textContentType="password"
          value={currentPassword}
        />
        <FieldLabel label="New Password" />
        <TextInput
          maxLength={1024}
          onChangeText={(value) => {
            setNewPassword(value);
            clearNotices();
          }}
          placeholder="At least 8 characters"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          textContentType="newPassword"
          value={newPassword}
        />
        <FieldLabel label="Confirm Password" />
        <TextInput
          maxLength={1024}
          onChangeText={(value) => {
            setConfirmPassword(value);
            clearNotices();
          }}
          placeholder="Repeat new password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          textContentType="newPassword"
          value={confirmPassword}
        />
        <ActionButton
          disabled={submitting}
          label={submitting ? "Updating Password..." : "Update Password"}
          onPress={submitChangePassword}
        />
        {submitting ? <InlineNotice message="Updating password..." /> : null}
        {success !== null ? (
          <InlineNotice tone="success" message={success} />
        ) : null}
        {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      </View>
    </SectionCard>
  );
}
