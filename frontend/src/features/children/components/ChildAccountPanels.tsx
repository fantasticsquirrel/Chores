import { Fragment, type FormEvent, type ReactElement } from "react";

import type { Child } from "../../../api";
import { Button, Card, FormField, InlineNotice, TextInput } from "../../../ui";
import type { UseChildAccountActionsResult } from "../hooks/useChildAccountActions";

type ChildAccountPanelsProps = {
  actions: UseChildAccountActionsResult;
  children: Child[];
  onSelectedChildIdChange: (childId: number | null) => void;
  selectedChildId: number | null;
};

type ChildSelectProps = {
  children: Child[];
  disabled: boolean;
  onChange: (childId: number | null) => void;
  selectedChildId: number | null;
};

function ChildSelect({
  children,
  disabled,
  onChange,
  selectedChildId,
}: ChildSelectProps): ReactElement {
  return (
    <FormField label="Child">
      <select
        className="text-input"
        value={selectedChildId ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value.length > 0 ? Number(event.target.value) : null,
          )
        }
        disabled={disabled || children.length === 0}
      >
        {children.length === 0 ? (
          <option value="">No children found</option>
        ) : null}
        {children.map((child) => (
          <option key={child.id} value={child.id}>
            {child.name} {child.active ? "" : "(inactive)"}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export function ChildAccountPanels({
  actions,
  children,
  onSelectedChildIdChange,
  selectedChildId,
}: ChildAccountPanelsProps): ReactElement {
  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    submit: () => Promise<void>,
  ): void {
    event.preventDefault();
    void submit();
  }

  return (
    <Fragment>
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Link Child Login</h2>
        </div>
        <form
          className="children-form"
          onSubmit={(event) => handleSubmit(event, actions.linkAccount.submit)}
        >
          <ChildSelect
            children={children}
            disabled={actions.linkAccount.submitting}
            onChange={onSelectedChildIdChange}
            selectedChildId={selectedChildId}
          />
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
            disabled={actions.linkAccount.submitting || children.length === 0}
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

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Reset Legacy Login Email</h2>
        </div>
        <form
          className="children-form"
          onSubmit={(event) => handleSubmit(event, actions.resetEmail.submit)}
        >
          <ChildSelect
            children={children}
            disabled={actions.resetEmail.submitting}
            onChange={onSelectedChildIdChange}
            selectedChildId={selectedChildId}
          />
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
              : "Reset Child Email"}
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

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Reset Child Password</h2>
        </div>
        <form
          className="children-form"
          onSubmit={(event) =>
            handleSubmit(event, actions.resetPassword.submit)
          }
        >
          <ChildSelect
            children={children}
            disabled={actions.resetPassword.submitting}
            onChange={onSelectedChildIdChange}
            selectedChildId={selectedChildId}
          />
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
            disabled={actions.resetPassword.submitting || children.length === 0}
          >
            {actions.resetPassword.submitting
              ? "Resetting..."
              : "Reset Child Password"}
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
    </Fragment>
  );
}
