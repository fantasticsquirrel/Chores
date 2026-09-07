import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { apiClient, type AuthSessionResponse } from "../api";
import { useAuth } from "../auth/useAuth";
import { useLoginAccountPicker } from "../features/auth/hooks/useLoginAccountPicker";
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
  const [passwordReset] = useState(() => searchParams.get("passwordReset") === "1");
  const { setAuthenticatedSession } = useAuth();
  const [mode, setMode] = useState<LoginMode>("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childParentEmail, setChildParentEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const accountPicker = useLoginAccountPicker();
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
    accountPicker.selectParentAccount("");
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
    accountPicker.selectChildAccount("");
    if (submitError !== null) {
      setSubmitError(null);
    }
  }

  function handleChildNameChange(value: string): void {
    setChildName(value);
    accountPicker.selectChildAccount("");
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
        if (password.length === 0) {
          setSubmitError("Email or legacy username and password are required.");
          return;
        }
        if (accountPicker.selectedParentAccount.length > 0) {
          session = await apiClient.loginAccount({
            account_token: accountPicker.selectedParentAccount,
            password,
          });
        } else {
          const trimmedEmail = email.trim();
          if (trimmedEmail.length === 0) {
            setSubmitError(
              "Email or legacy username and password are required.",
            );
            return;
          }
          session = await apiClient.login({ email: trimmedEmail, password });
        }
        setPassword("");
      } else {
        if (accountPicker.selectedChildAccount.length > 0) {
          if (childPassword.length === 0) {
            setSubmitError("Child account and password are required.");
            return;
          }
          session = await apiClient.loginAccount({
            account_token: accountPicker.selectedChildAccount,
            password: childPassword,
          });
        } else {
          const trimmedParentEmail = childParentEmail.trim();
          const trimmedChildName = childName.trim();
          if (
            trimmedParentEmail.length === 0 ||
            trimmedChildName.length === 0 ||
            childPassword.length === 0
          ) {
            setSubmitError(
              "Parent email or legacy username, child name, and child password are required.",
            );
            return;
          }
          session = await apiClient.childLogin({
            parent_email: trimmedParentEmail,
            child_name: trimmedChildName,
            password: childPassword,
          });
        }
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
        Parents use their email or legacy username and password. Kids can use a
        parent email or legacy username, their child name, and their child
        password.
      </p>
      {passwordChanged ? (
        <InlineNotice variant="info">Password changed. Sign in again with your new password.</InlineNotice>
      ) : null}
      {passwordReset ? (
        <InlineNotice variant="info">Try signing in. If you cannot sign in, request a new reset link.</InlineNotice>
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
            {accountPicker.parentAccounts.length > 0 ? (
              <FormField label="Parent Account">
                <select
                  value={accountPicker.selectedParentAccount}
                  onChange={(event) => {
                    accountPicker.selectParentAccount(event.target.value);
                    setEmail("");
                    setPassword("");
                    setSubmitError(null);
                  }}
                  disabled={submitting}
                >
                  <option value="">Enter email or username manually</option>
                  {accountPicker.parentAccounts.map((account) => (
                    <option
                      key={account.account_token}
                      value={account.account_token}
                    >
                      {account.display_name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            {accountPicker.selectedParentAccount.length === 0 ? (
              <FormField label="Email or Username">
                <TextInput
                  type="text"
                  value={email}
                  onChange={(event) => handleEmailChange(event.target.value)}
                  placeholder="Email or legacy username"
                  autoComplete="username"
                  disabled={submitting}
                  maxLength={320}
                  required
                />
              </FormField>
            ) : null}
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
            <Link className="password-reset-link" to="/forgot-password">
              Forgot password?
            </Link>
            <Link className="password-reset-link" to="/register">
              Create a household account
            </Link>
          </>
        ) : (
          <>
            {accountPicker.childAccounts.length > 0 ? (
              <FormField label="Child Account">
                <select
                  value={accountPicker.selectedChildAccount}
                  onChange={(event) => {
                    accountPicker.selectChildAccount(event.target.value);
                    setChildParentEmail("");
                    setChildName("");
                    setChildPassword("");
                    setSubmitError(null);
                  }}
                  disabled={submitting}
                >
                  <option value="">Enter child details manually</option>
                  {accountPicker.childAccounts.map((account) => (
                    <option
                      key={account.account_token}
                      value={account.account_token}
                    >
                      {account.display_name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            {accountPicker.selectedChildAccount.length === 0 ? (
              <>
                <FormField label="Parent Email or Username">
                  <TextInput
                    type="text"
                    value={childParentEmail}
                    onChange={(event) =>
                      handleChildParentEmailChange(event.target.value)
                    }
                    placeholder="Parent email or legacy username"
                    autoComplete="username"
                    disabled={submitting}
                    maxLength={320}
                    required
                  />
                </FormField>
                <FormField label="Child Name">
                  <TextInput
                    type="text"
                    value={childName}
                    onChange={(event) =>
                      handleChildNameChange(event.target.value)
                    }
                    placeholder="Enter child name"
                    autoComplete="username"
                    disabled={submitting}
                    maxLength={255}
                    required
                  />
                </FormField>
              </>
            ) : null}
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
        {mode === "child" ? (
          <p className="password-reset-guidance">
            Ask a parent to reset their password from the Parent sign-in screen.
          </p>
        ) : null}
        {accountPicker.accountListUnavailable ? (
          <p className="password-reset-guidance">
            Account list unavailable. Enter the login details manually.
          </p>
        ) : null}
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
