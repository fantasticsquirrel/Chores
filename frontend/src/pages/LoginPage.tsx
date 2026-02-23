import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient, ApiClientError, type AuthSessionResponse } from "../api";
import { useAuth } from "../auth/useAuth";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";

function formatLoginError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

function getPostLoginPath(session: AuthSessionResponse): string {
  return session.user.role === "CHILD" ? "/child/today" : "/parent/dashboard";
}

export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleEmailChange(value: string): void {
    setEmail(value);
    if (submitError !== null) {
      setSubmitError(null);
    }
  }

  function handlePasswordChange(value: string): void {
    setPassword(value);
    if (submitError !== null) {
      setSubmitError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0 || password.length === 0) {
      setSubmitError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const session = await apiClient.login({ email: trimmedEmail, password });
      setAuthenticatedSession(session);
      setPassword("");
      navigate(getPostLoginPath(session), { replace: true });
    } catch (error: unknown) {
      setSubmitError(formatLoginError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="section">
      <h1>Welcome Back</h1>
      <p>Sign in to manage chores, approvals, and balances for your household.</p>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <FormField label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            placeholder="parent@example.com"
            autoComplete="email"
            disabled={submitting}
            maxLength={320}
            required
          />
        </FormField>
        <FormField label="Password">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => handlePasswordChange(event.target.value)}
            autoComplete="current-password"
            disabled={submitting}
            maxLength={1024}
            required
          />
        </FormField>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing In..." : "Sign In"}
        </Button>
      </form>
      {submitting ? <InlineNotice variant="info">Signing you in...</InlineNotice> : null}
      {submitError !== null ? <InlineNotice variant="error">Could not sign in: {submitError}</InlineNotice> : null}
    </Card>
  );
}
