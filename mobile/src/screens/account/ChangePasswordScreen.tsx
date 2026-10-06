import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import { ActionButton } from "../../components/ActionButton";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { SectionCard } from "../../components/SectionCard";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
import { formatError } from "../../utils/format";

export function ChangePasswordScreen({ onPasswordChanged }: { onPasswordChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mounted = useRef(false);
  const authenticationGeneration = apiClient.authenticationGeneration;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    // A replacement session must not inherit another actor's credentials or notices.
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSubmitting(false);
    setError(null);
    setSuccess(null);
  }, [authenticationGeneration]);

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

    if (newPassword.length < 15) {
      setSuccess(null);
      setError("New password must be at least 15 characters.");
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
    const generation = apiClient.authenticationGeneration;
    const current = () => mounted.current && generation === apiClient.authenticationGeneration;
    try {
      await apiClient.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (generation !== apiClient.authenticationGeneration) return;
      if (mounted.current) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("Password changed. Sign in again.");
      }
      // Revocation belongs to the matching auth controller, not the form's
      // visibility. Leaving Security must not retain a server-revoked session.
      onPasswordChanged();
    } catch (changeError) {
      if (current()) setError(`Could not change password: ${formatError(changeError)}`);
    } finally {
      if (current()) setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Account Security">
      <View style={shellStyles.compactStack}>
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
          style={formStyles.input}
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
          placeholder="At least 15 characters"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={formStyles.input}
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
          style={formStyles.input}
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
