import { useState, type FormEvent, type ReactElement } from "react";

import "../children.css";
import type { Child } from "../../../api";
import { Button, Card, FormField, InlineNotice, TextInput } from "../../../ui";
import type { UseChildAccountActionsResult } from "../hooks/useChildAccountActions";

type ChildAccountPanelsProps = {
  actions: UseChildAccountActionsResult;
  children: Child[];
  selectedChildId: number | null;
};

export function ChildAccountPanels({
  actions,
  children,
  selectedChildId,
}: ChildAccountPanelsProps): ReactElement {
  const child = children.find((item) => item.id === selectedChildId);
  const [action, setAction] = useState<"link" | "password" | "email">(
    child?.has_login ? "password" : "link",
  );
  const busy =
    actions.linkAccount.submitting ||
    actions.resetEmail.submitting ||
    actions.resetPassword.submitting;
  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    submit: () => Promise<void>,
  ): void {
    event.preventDefault();
    void submit();
  }

  return (
    <div
      className="dashboard-grid child-account-workspace"
      aria-label={`${child?.name ?? "Child"} account tools`}
    >
      <Card className="dashboard-panel">
        <h2>{child?.name ?? "Child"}’s account</h2>
        <div className="quick-actions">
          <Button
            type="button"
            disabled={busy}
            aria-pressed={action === "link"}
            onClick={() => setAction("link")}
          >
            Link Child Login
          </Button>
          <Button
            type="button"
            disabled={busy}
            aria-pressed={action === "password"}
            onClick={() => setAction("password")}
          >
            Reset Password
          </Button>
          <Button
            type="button"
            disabled={busy}
            aria-pressed={action === "email"}
            onClick={() => setAction("email")}
          >
            Advanced account tools
          </Button>
        </div>
        <details>
          <summary>How child sign-in works</summary>
          <p>
            Children can sign in with a parent login email, their child name,
            and child password. Existing legacy email/password sign-ins still
            work.
          </p>
        </details>
      </Card>
      {action === "link" ? (
        <>
          <Card className="dashboard-panel">
            <div className="panel-header-row">
              <h2>Link Child Login</h2>
            </div>
            <form
              className="children-form"
              onSubmit={(event) =>
                handleSubmit(event, actions.linkAccount.submit)
              }
            >
              <FormField label="Legacy Login Email (optional, leave blank to auto-generate)">
                <TextInput
                  type="email"
                  value={actions.linkAccount.email}
                  onChange={(event) =>
                    actions.linkAccount.setEmail(event.target.value)
                  }
                  placeholder="kid@example.com"
                  disabled={actions.linkAccount.submitting}
                />
              </FormField>
              <FormField label="Temporary Password">
                <TextInput
                  type="password"
                  value={actions.linkAccount.password}
                  onChange={(event) =>
                    actions.linkAccount.setPassword(event.target.value)
                  }
                  placeholder="at least 8 chars"
                  disabled={actions.linkAccount.submitting}
                />
              </FormField>
              <Button
                type="submit"
                disabled={
                  actions.linkAccount.submitting || children.length === 0
                }
              >
                {actions.linkAccount.submitting
                  ? "Linking..."
                  : "Create Linked Child Login"}
              </Button>
            </form>
            {actions.linkAccount.error !== null ? (
              <InlineNotice variant="error">
                Could not link child login: {actions.linkAccount.error}
              </InlineNotice>
            ) : null}
            {actions.linkAccount.success !== null ? (
              <InlineNotice>{actions.linkAccount.success}</InlineNotice>
            ) : null}
          </Card>
        </>
      ) : null}

      {action === "email" ? (
        <Card className="dashboard-panel">
          <div className="panel-header-row">
            <h2>Reset Legacy Login Email</h2>
            <p>
              This changes {child?.name}’s legacy email and signs out their
              existing sessions.
            </p>
          </div>
          <form
            className="children-form"
            onSubmit={(event) => handleSubmit(event, actions.resetEmail.submit)}
          >
            <FormField label="New Legacy Login Email (optional, leave blank to auto-generate)">
              <TextInput
                type="email"
                value={actions.resetEmail.email}
                onChange={(event) =>
                  actions.resetEmail.setEmail(event.target.value)
                }
                placeholder="kid+new@example.com"
                disabled={actions.resetEmail.submitting}
              />
            </FormField>
            <Button
              type="submit"
              disabled={actions.resetEmail.submitting || children.length === 0}
            >
              {actions.resetEmail.submitting
                ? "Resetting..."
                : `Reset Child Email for ${child?.name ?? "child"}`}
            </Button>
          </form>
          {actions.resetEmail.error !== null ? (
            <InlineNotice variant="error">
              Could not reset child email: {actions.resetEmail.error}
            </InlineNotice>
          ) : null}
          {actions.resetEmail.success !== null ? (
            <InlineNotice>{actions.resetEmail.success}</InlineNotice>
          ) : null}
        </Card>
      ) : null}

      {action === "password" ? (
        <Card className="dashboard-panel">
          <div className="panel-header-row">
            <h2>Reset Child Password</h2>
            <p>
              This replaces {child?.name}’s password and signs out their
              existing sessions.
            </p>
          </div>
          <form
            className="children-form"
            onSubmit={(event) =>
              handleSubmit(event, actions.resetPassword.submit)
            }
          >
            <FormField label="New Temporary Password">
              <TextInput
                type="password"
                value={actions.resetPassword.password}
                onChange={(event) =>
                  actions.resetPassword.setPassword(event.target.value)
                }
                placeholder="at least 8 chars"
                disabled={actions.resetPassword.submitting}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirm Temporary Password">
              <TextInput
                type="password"
                value={actions.resetPassword.confirmation}
                onChange={(event) =>
                  actions.resetPassword.setConfirmation(event.target.value)
                }
                placeholder="repeat temporary password"
                disabled={actions.resetPassword.submitting}
                autoComplete="new-password"
              />
            </FormField>
            <Button
              type="submit"
              disabled={
                actions.resetPassword.submitting || children.length === 0
              }
            >
              {actions.resetPassword.submitting
                ? "Resetting..."
                : `Reset Child Password for ${child?.name ?? "child"}`}
            </Button>
          </form>
          {actions.resetPassword.error !== null ? (
            <InlineNotice variant="error">
              Could not reset child password: {actions.resetPassword.error}
            </InlineNotice>
          ) : null}
          {actions.resetPassword.success !== null ? (
            <InlineNotice>{actions.resetPassword.success}</InlineNotice>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
