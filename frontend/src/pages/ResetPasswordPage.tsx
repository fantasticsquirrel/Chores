import type { FormEvent, ReactElement } from "react";
import { useLayoutEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "../api";
import { formatApiError } from "../lib/errors";
import { clearPasswordResetFragment, readPasswordResetTokenFromLocation } from "../lib/password-reset-token";
import { Button, ButtonLink, Card, FormField, InlineNotice, TextInput } from "../ui";

const PARENT_PASSWORD_MIN_LENGTH = 15;

export function ResetPasswordPage(): ReactElement {
  const navigate = useNavigate();
  const [token] = useState(readPasswordResetTokenFromLocation);
  useLayoutEffect(() => {
    clearPasswordResetFragment();
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (token === null) {
    return (
      <Card as="section" className="password-reset-card">
        <h1>Reset Link Unavailable</h1>
        <p>
          This reset link is missing, incomplete, or has already been removed from this browser. Request a new reset link to continue.
        </p>
        <ButtonLink to="/forgot-password">Request a New Reset Link</ButtonLink>
      </Card>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) {
      return;
    }

    if (newPassword.length < PARENT_PASSWORD_MIN_LENGTH) {
      setSubmitError(`Your new password must be at least ${PARENT_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmation) {
      setSubmitError("New password and confirmation must match.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      // Confirmation deliberately uses a uniform 202 acknowledgement for every
      // capability outcome. Do not claim this browser's capability succeeded;
      // direct the user to sign in and let authentication be authoritative.
      await apiClient.confirmPasswordReset({ token: token!, new_password: newPassword });
      setNewPassword("");
      setConfirmation("");
      navigate("/login?passwordReset=1", { replace: true });
    } catch (error: unknown) {
      setSubmitError(
        `Unable to reset your password. ${formatApiError(error)} Request a new link if this one has expired.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="section" className="password-reset-card">
      <h1>Set a New Password</h1>
      <p>
        Choose a new parent password. For your protection, signing in is required again after your password has been changed.
      </p>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <FormField label="New Password">
          <TextInput
            autoComplete="new-password"
            disabled={submitting}
            maxLength={1024}
            minLength={PARENT_PASSWORD_MIN_LENGTH}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setSubmitError(null);
            }}
            required
            type="password"
            value={newPassword}
          />
        </FormField>
        <FormField label="Confirm New Password">
          <TextInput
            autoComplete="new-password"
            disabled={submitting}
            maxLength={1024}
            minLength={PARENT_PASSWORD_MIN_LENGTH}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setSubmitError(null);
            }}
            required
            type="password"
            value={confirmation}
          />
        </FormField>
        <p className="password-reset-policy">Use at least {PARENT_PASSWORD_MIN_LENGTH} characters.</p>
        <Button disabled={submitting} type="submit">
          {submitting ? "Setting New Password..." : "Set New Password"}
        </Button>
      </form>
      {submitError !== null ? <InlineNotice variant="error">{submitError}</InlineNotice> : null}
      <p className="password-reset-secondary">
        <Link to="/login">Back to sign in</Link>
      </p>
    </Card>
  );
}
