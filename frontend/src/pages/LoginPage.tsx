import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiClient, type AuthSessionResponse } from "../api";
import { useAuth } from "../auth/useAuth";
import { formatApiError } from "../lib/errors";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";

type LoginMode = "parent" | "child";

function getPostLoginPath(session: AuthSessionResponse): string {
  return session.user.role === "CHILD" ? "/child/today" : "/parent/dashboard";
}

export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [passwordChanged] = useState(() => {
    const changed = searchParams.get("passwordChanged") === "1" || window.sessionStorage.getItem("family-manager.password-changed") === "1";
    window.sessionStorage.removeItem("family-manager.password-changed");
    return changed;
  });
  const { setAuthenticatedSession } = useAuth();
  const [mode, setMode] = useState<LoginMode>("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childParentEmail, setChildParentEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleModeChange(nextMode: LoginMode): void {
    setMode(nextMode);
    if (submitError !== null) {
      setSubmitError(null);
    }
  }

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

  function handleChildParentEmailChange(value: string): void {
    setChildParentEmail(value);
    if (submitError !== null) {
      setSubmitError(null);
    }
  }

  function handleChildNameChange(value: string): void {
    setChildName(value);
    if (submitError !== null) {
      setSubmitError(null);
    }
  }

  function handleChildPasswordChange(value: string): void {
    setChildPassword(value);
    if (submitError !== null) {
      setSubmitError(null);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setSubmitting(true);
    setSubmitError(null);

    try {
      let session: AuthSessionResponse;
      if (mode === "parent") {
        const trimmedEmail = email.trim();
        if (trimmedEmail.length === 0 || password.length === 0) {
          setSubmitError("Email and password are required.");
          return;
        }
        session = await apiClient.login({ email: trimmedEmail, password });
        setPassword("");
      } else {
        const trimmedParentEmail = childParentEmail.trim();
        const trimmedChildName = childName.trim();
        if (
          trimmedParentEmail.length === 0 ||
          trimmedChildName.length === 0 ||
          childPassword.length === 0
        ) {
          setSubmitError(
            "Parent email, child name, and child password are required.",
          );
          return;
        }
        session = await apiClient.childLogin({
          parent_email: trimmedParentEmail,
          child_name: trimmedChildName,
          password: childPassword,
        });
        setChildPassword("");
      }
      setAuthenticatedSession(session);
      navigate(getPostLoginPath(session), { replace: true });
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="section">
      <h1>Welcome Back</h1>
      <p>
        Parents use their login email and password. Kids can use a parent login
        email, their child name, and their child password.
      </p>
      {passwordChanged ? (
        <InlineNotice variant="info">Password changed. Sign in again with your new password.</InlineNotice>
      ) : null}
      <div className="auth-mode-switch" role="tablist" aria-label="Login mode">
        <button
          aria-selected={mode === "parent"}
          className={mode === "parent" ? "active" : ""}
          disabled={submitting}
          onClick={() => handleModeChange("parent")}
          role="tab"
          type="button"
        >
          Parent
        </button>
        <button
          aria-selected={mode === "child"}
          className={mode === "child" ? "active" : ""}
          disabled={submitting}
          onClick={() => handleModeChange("child")}
          role="tab"
          type="button"
        >
          Child
        </button>
      </div>
      <form
        className="auth-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {mode === "parent" ? (
          <>
            <FormField label="Login Email">
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
          </>
        ) : (
          <>
            <FormField label="Parent Login Email">
              <TextInput
                type="email"
                value={childParentEmail}
                onChange={(event) =>
                  handleChildParentEmailChange(event.target.value)
                }
                placeholder="parent@example.com"
                autoComplete="email"
                disabled={submitting}
                maxLength={320}
                required
              />
            </FormField>
            <FormField label="Child Name">
              <TextInput
                type="text"
                value={childName}
                onChange={(event) => handleChildNameChange(event.target.value)}
                placeholder="Enter child name"
                autoComplete="username"
                disabled={submitting}
                maxLength={255}
                required
              />
            </FormField>
            <FormField label="Child Password">
              <TextInput
                type="password"
                value={childPassword}
                onChange={(event) =>
                  handleChildPasswordChange(event.target.value)
                }
                autoComplete="current-password"
                disabled={submitting}
                maxLength={1024}
                required
              />
            </FormField>
          </>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing In..." : "Sign In"}
        </Button>
      </form>
      {submitting ? (
        <InlineNotice variant="info">Signing you in...</InlineNotice>
      ) : null}
      {submitError !== null ? (
        <InlineNotice variant="error">
          Could not sign in: {submitError}
        </InlineNotice>
      ) : null}
    </Card>
  );
}
