import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import { apiClient, type Child } from "../api";
import { useAuth } from "../auth/useAuth";
import { formatApiError } from "../lib/errors";
import {
  Badge,
  Button,
  Card,
  CheckboxField,
  FormField,
  InlineNotice,
  TextInput,
} from "../ui";

type PageState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

export function ParentChildrenPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const [state, setState] = useState<PageState>({
    children: [],
    loading: true,
    error: null,
  });
  const [nameInput, setNameInput] = useState("");
  const [activeOnCreate, setActiveOnCreate] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingChildId, setUpdatingChildId] = useState<number | null>(null);

  // Child login linking form
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [linkAccountError, setLinkAccountError] = useState<string | null>(null);
  const [linkAccountSuccess, setLinkAccountSuccess] = useState<string | null>(
    null,
  );
  const [resetEmailInput, setResetEmailInput] = useState("");
  const [resettingEmail, setResettingEmail] = useState(false);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [resetEmailSuccess, setResetEmailSuccess] = useState<string | null>(
    null,
  );
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(
    null,
  );
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<
    string | null
  >(null);

  const loadChildren = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setState({
        children: [],
        loading: false,
        error: "Could not determine household scope.",
      });
      return;
    }

    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const children = await apiClient.listChildren({
        household_id: householdId,
      });
      setState({ children, loading: false, error: null });
      if (children.length > 0) {
        setSelectedChildId((current) => current ?? children[0].id);
      }
    } catch (error: unknown) {
      setState({ children: [], loading: false, error: formatApiError(error) });
    }
  }, [householdId]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  async function handleCreateChild(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const trimmedName = nameInput.trim();
    if (trimmedName.length === 0) {
      setSubmitError("Child name is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (householdId === null) {
        throw new Error("Could not determine household scope.");
      }

      await apiClient.createChild({
        household_id: householdId,
        name: trimmedName,
        active: activeOnCreate,
      });
      setNameInput("");
      setActiveOnCreate(true);
      await loadChildren();
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(child: Child): Promise<void> {
    if (householdId === null) {
      setSubmitError("Could not determine household scope.");
      return;
    }

    setUpdatingChildId(child.id);
    setSubmitError(null);

    try {
      await apiClient.updateChild(child.id, {
        household_id: householdId,
        active: !child.active,
      });
      await loadChildren();
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setUpdatingChildId(null);
    }
  }

  async function handleCreateChildAccount(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLinkAccountError(null);
    setLinkAccountSuccess(null);

    if (householdId === null) {
      setLinkAccountError("Could not determine household scope.");
      return;
    }
    if (selectedChildId === null) {
      setLinkAccountError("Choose a child first.");
      return;
    }
    if (childEmail.trim().length > 0 && childEmail.trim().length < 3) {
      setLinkAccountError("If provided, email must be valid-ish length.");
      return;
    }
    if (childPassword.length < 8) {
      setLinkAccountError("Password must be at least 8 characters.");
      return;
    }

    setLinkingAccount(true);
    try {
      const normalizedEmail = childEmail.trim().toLowerCase();
      const account = await apiClient.createChildAccount(selectedChildId, {
        household_id: householdId,
        email: normalizedEmail.length > 0 ? normalizedEmail : null,
        password: childPassword,
      });
      const childName =
        state.children.find((c) => c.id === selectedChildId)?.name ?? "child";
      setLinkAccountSuccess(
        `Linked login created for ${childName}. Child can sign in with a parent login email, ${childName}, and the child password. Legacy email ${account.email} still works for email/password sign-in.`,
      );
      setChildEmail("");
      setChildPassword("");
    } catch (error: unknown) {
      setLinkAccountError(formatApiError(error));
    } finally {
      setLinkingAccount(false);
    }
  }

  async function handleResetChildEmail(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setResetEmailError(null);
    setResetEmailSuccess(null);

    if (householdId === null) {
      setResetEmailError("Could not determine household scope.");
      return;
    }
    if (selectedChildId === null) {
      setResetEmailError("Choose a child first.");
      return;
    }

    setResettingEmail(true);
    try {
      const normalizedEmail = resetEmailInput.trim().toLowerCase();
      const account = await apiClient.resetChildAccountEmail(selectedChildId, {
        household_id: householdId,
        email: normalizedEmail.length > 0 ? normalizedEmail : null,
      });
      const childName =
        state.children.find((c) => c.id === selectedChildId)?.name ?? "child";
      setResetEmailSuccess(
        `Updated legacy login email for ${childName}. Parent email + child name + child password is recommended; ${account.email} still works for email/password sign-in.`,
      );
      setResetEmailInput("");
    } catch (error: unknown) {
      setResetEmailError(formatApiError(error));
    } finally {
      setResettingEmail(false);
    }
  }

  async function handleResetChildPassword(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setResetPasswordError(null);
    setResetPasswordSuccess(null);

    if (householdId === null) {
      setResetPasswordError("Could not determine household scope.");
      return;
    }
    if (selectedChildId === null) {
      setResetPasswordError("Choose a child first.");
      return;
    }
    if (resetPasswordInput.length < 8) {
      setResetPasswordError(
        "Temporary password must be at least 8 characters.",
      );
      return;
    }
    if (resetPasswordInput !== resetPasswordConfirm) {
      setResetPasswordError("Temporary password and confirmation must match.");
      return;
    }

    setResettingPassword(true);
    try {
      const account = await apiClient.resetChildAccountPassword(
        selectedChildId,
        {
          household_id: householdId,
          new_password: resetPasswordInput,
        },
      );
      const childName =
        state.children.find((c) => c.id === selectedChildId)?.name ?? "child";
      setResetPasswordSuccess(
        `Updated password for ${childName}. Child can sign in with a parent login email, ${childName}, and the new child password. Legacy email ${account.email} still works.`,
      );
      setResetPasswordInput("");
      setResetPasswordConfirm("");
    } catch (error: unknown) {
      setResetPasswordError(formatApiError(error));
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <section className="dashboard-grid" aria-label="Parent children management">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Children Management</h1>
          <Badge>Household {householdId ?? "Unknown"}</Badge>
        </div>
        <p>
          Create child profiles and manage child login accounts. Children can
          sign in with a parent login email, their child name, and child
          password. Optional legacy login emails still work for email/password
          sign-in.
        </p>
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Add Child</h2>
        </div>
        <form
          className="children-form"
          onSubmit={(event) => void handleCreateChild(event)}
        >
          <FormField label="Name">
            <TextInput
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Avery"
              maxLength={255}
              disabled={submitting}
            />
          </FormField>
          <CheckboxField
            label="Active"
            checked={activeOnCreate}
            onChange={(event) => setActiveOnCreate(event.target.checked)}
            disabled={submitting}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Create Child"}
          </Button>
        </form>
        {submitError !== null ? (
          <InlineNotice variant="error">
            Could not save child: {submitError}
          </InlineNotice>
        ) : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Link Child Login</h2>
        </div>
        <form
          className="children-form"
          onSubmit={(event) => void handleCreateChildAccount(event)}
        >
          <FormField label="Child">
            <select
              className="text-input"
              value={selectedChildId ?? ""}
              onChange={(event) =>
                setSelectedChildId(
                  event.target.value.length > 0
                    ? Number(event.target.value)
                    : null,
                )
              }
              disabled={linkingAccount || state.children.length === 0}
            >
              {state.children.length === 0 ? (
                <option value="">No children found</option>
              ) : null}
              {state.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} {child.active ? "" : "(inactive)"}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Legacy Login Email (optional, leave blank to auto-generate)">
            <TextInput
              type="email"
              value={childEmail}
              onChange={(event) => setChildEmail(event.target.value)}
              placeholder="kid@example.com"
              disabled={linkingAccount}
            />
          </FormField>
          <FormField label="Temporary Password">
            <TextInput
              type="password"
              value={childPassword}
              onChange={(event) => setChildPassword(event.target.value)}
              placeholder="at least 8 chars"
              disabled={linkingAccount}
            />
          </FormField>
          <Button
            type="submit"
            disabled={linkingAccount || state.children.length === 0}
          >
            {linkingAccount ? "Linking..." : "Create Linked Child Login"}
          </Button>
        </form>
        {linkAccountError !== null ? (
          <InlineNotice variant="error">
            Could not link child login: {linkAccountError}
          </InlineNotice>
        ) : null}
        {linkAccountSuccess !== null ? (
          <InlineNotice>{linkAccountSuccess}</InlineNotice>
        ) : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Reset Legacy Login Email</h2>
        </div>
        <form
          className="children-form"
          onSubmit={(event) => void handleResetChildEmail(event)}
        >
          <FormField label="Child">
            <select
              className="text-input"
              value={selectedChildId ?? ""}
              onChange={(event) =>
                setSelectedChildId(
                  event.target.value.length > 0
                    ? Number(event.target.value)
                    : null,
                )
              }
              disabled={resettingEmail || state.children.length === 0}
            >
              {state.children.length === 0 ? (
                <option value="">No children found</option>
              ) : null}
              {state.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} {child.active ? "" : "(inactive)"}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="New Legacy Login Email (optional, leave blank to auto-generate)">
            <TextInput
              type="email"
              value={resetEmailInput}
              onChange={(event) => setResetEmailInput(event.target.value)}
              placeholder="kid+new@example.com"
              disabled={resettingEmail}
            />
          </FormField>
          <Button
            type="submit"
            disabled={resettingEmail || state.children.length === 0}
          >
            {resettingEmail ? "Resetting..." : "Reset Child Email"}
          </Button>
        </form>
        {resetEmailError !== null ? (
          <InlineNotice variant="error">
            Could not reset child email: {resetEmailError}
          </InlineNotice>
        ) : null}
        {resetEmailSuccess !== null ? (
          <InlineNotice>{resetEmailSuccess}</InlineNotice>
        ) : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Reset Child Password</h2>
        </div>
        <form
          className="children-form"
          onSubmit={(event) => void handleResetChildPassword(event)}
        >
          <FormField label="Child">
            <select
              className="text-input"
              value={selectedChildId ?? ""}
              onChange={(event) =>
                setSelectedChildId(
                  event.target.value.length > 0
                    ? Number(event.target.value)
                    : null,
                )
              }
              disabled={resettingPassword || state.children.length === 0}
            >
              {state.children.length === 0 ? (
                <option value="">No children found</option>
              ) : null}
              {state.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} {child.active ? "" : "(inactive)"}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="New Temporary Password">
            <TextInput
              type="password"
              value={resetPasswordInput}
              onChange={(event) => setResetPasswordInput(event.target.value)}
              placeholder="at least 8 chars"
              disabled={resettingPassword}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm Temporary Password">
            <TextInput
              type="password"
              value={resetPasswordConfirm}
              onChange={(event) => setResetPasswordConfirm(event.target.value)}
              placeholder="repeat temporary password"
              disabled={resettingPassword}
              autoComplete="new-password"
            />
          </FormField>
          <Button
            type="submit"
            disabled={resettingPassword || state.children.length === 0}
          >
            {resettingPassword ? "Resetting..." : "Reset Child Password"}
          </Button>
        </form>
        {resetPasswordError !== null ? (
          <InlineNotice variant="error">
            Could not reset child password: {resetPasswordError}
          </InlineNotice>
        ) : null}
        {resetPasswordSuccess !== null ? (
          <InlineNotice>{resetPasswordSuccess}</InlineNotice>
        ) : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Children</h2>
        </div>

        {state.loading ? <p>Loading children...</p> : null}
        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">
            Could not load children: {state.error}
          </InlineNotice>
        ) : null}

        {!state.loading &&
        state.error === null &&
        state.children.length === 0 ? (
          <p>No children found yet for this household.</p>
        ) : null}

        {!state.loading && state.error === null && state.children.length > 0 ? (
          <ul className="balance-list" aria-label="Children list">
            {state.children.map((child) => {
              const isUpdating = updatingChildId === child.id;
              const buttonLabel = child.active ? "Set Inactive" : "Set Active";

              return (
                <li key={child.id} className="balance-item">
                  <div>
                    <p className="balance-name">{child.name}</p>
                    <p className="balance-meta">
                      {child.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <Button
                    onClick={() => void handleToggleActive(child)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Updating..." : buttonLabel}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
