import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "../api";
import { formatApiError } from "../lib/errors";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";

const GENERIC_ACK = "If an eligible account exists for that address, reset instructions will arrive shortly.";

export function ForgotPasswordPage(): ReactElement {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.requestPasswordReset({ email: trimmedEmail });
      setEmail("");
      setAcknowledged(true);
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="section" className="password-reset-card">
      <h1>Forgot Your Password?</h1>
      <p>
        Enter the email for your parent account. If an eligible account exists, reset instructions will arrive shortly.
      </p>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <FormField label="Email">
          <TextInput
            autoComplete="email"
            disabled={submitting}
            maxLength={320}
            onChange={(event) => {
              setEmail(event.target.value);
              setAcknowledged(false);
              setSubmitError(null);
            }}
            required
            type="email"
            value={email}
          />
        </FormField>
        <Button disabled={submitting || email.trim().length === 0} type="submit">
          {submitting ? "Requesting Reset Link..." : "Request Reset Link"}
        </Button>
      </form>
      {acknowledged ? <InlineNotice role="status">{GENERIC_ACK}</InlineNotice> : null}
      {submitError !== null ? (
        <InlineNotice variant="error">Could not request a reset link: {submitError}</InlineNotice>
      ) : null}
      <p className="password-reset-secondary">
        <Link to="/login">Back to sign in</Link>
      </p>
    </Card>
  );
}
