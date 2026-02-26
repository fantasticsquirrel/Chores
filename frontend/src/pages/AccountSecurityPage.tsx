import type { FormEvent, ReactElement } from "react";
import { useState } from "react";

import { apiClient, ApiClientError } from "../api";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";

function formatChangePasswordError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

export function AccountSecurityPage(): ReactElement {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  function clearNotices(): void {
    if (submitError !== null) {
      setSubmitError(null);
    }
    if (submitSuccess !== null) {
      setSubmitSuccess(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (currentPassword.length === 0 || newPassword.length === 0 || confirmPassword.length === 0) {
      setSubmitSuccess(null);
      setSubmitError("All password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setSubmitSuccess(null);
      setSubmitError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitSuccess(null);
      setSubmitError("New password and confirm password must match.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await apiClient.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSubmitSuccess("Password changed successfully.");
    } catch (error: unknown) {
      setSubmitError(formatChangePasswordError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="section">
      <h1>Account Security</h1>
      <p>Change your password for this account.</p>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <FormField label="Current Password">
          <TextInput
            type="password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              clearNotices();
            }}
            autoComplete="current-password"
            disabled={submitting}
            maxLength={1024}
            required
          />
        </FormField>
        <FormField label="New Password">
          <TextInput
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              clearNotices();
            }}
            autoComplete="new-password"
            disabled={submitting}
            maxLength={1024}
            required
          />
        </FormField>
        <FormField label="Confirm Password">
          <TextInput
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearNotices();
            }}
            autoComplete="new-password"
            disabled={submitting}
            maxLength={1024}
            required
          />
        </FormField>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Updating Password..." : "Update Password"}
        </Button>
      </form>
      {submitting ? <InlineNotice variant="info">Updating password...</InlineNotice> : null}
      {submitSuccess !== null ? <InlineNotice variant="info">{submitSuccess}</InlineNotice> : null}
      {submitError !== null ? (
        <InlineNotice variant="error">Could not change password: {submitError}</InlineNotice>
      ) : null}
    </Card>
  );
}
