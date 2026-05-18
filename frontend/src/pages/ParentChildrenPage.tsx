import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import { ApiClientError, apiClient, type Child } from "../api";
import { useAuth } from "../auth/useAuth";
import { Badge, Button, Card, CheckboxField, FormField, InlineNotice, TextInput } from "../ui";

type PageState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

function formatLoadError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

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
  const [linkAccountSuccess, setLinkAccountSuccess] = useState<string | null>(null);
  const [resetEmailInput, setResetEmailInput] = useState("");
  const [resettingEmail, setResettingEmail] = useState(false);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [resetEmailSuccess, setResetEmailSuccess] = useState<string | null>(null);

  const loadChildren = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setState({ children: [], loading: false, error: "Could not determine household scope." });
      return;
    }

    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const children = await apiClient.listChildren({ household_id: householdId });
      setState({ children, loading: false, error: null });
      if (children.length > 0) {
        setSelectedChildId((current) => current ?? children[0].id);
      }
    } catch (error: unknown) {
      setState({ children: [], loading: false, error: formatLoadError(error) });
    }
  }, [householdId]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  async function handleCreateChild(event: FormEvent<HTMLFormElement>): Promise<void> {
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
      setSubmitError(formatLoadError(error));
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
      setSubmitError(formatLoadError(error));
    } finally {
      setUpdatingChildId(null);
    }
  }

  async function handleCreateChildAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
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
      const childName = state.children.find((c) => c.id === selectedChildId)?.name ?? "child";
      setLinkAccountSuccess(`Linked login created for ${childName}: ${account.email}`);
      setChildEmail("");
      setChildPassword("");
    } catch (error: unknown) {
      setLinkAccountError(formatLoadError(error));
    } finally {
      setLinkingAccount(false);
    }
  }

  async function handleResetChildEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
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
      const childName = state.children.find((c) => c.id === selectedChildId)?.name ?? "child";
      setResetEmailSuccess(`Updated child login email for ${childName}: ${account.email}`);
      setResetEmailInput("");
    } catch (error: unknown) {
      setResetEmailError(formatLoadError(error));
    } finally {
      setResettingEmail(false);
    }
  }

  return (
    <section className="dashboard-grid" aria-label="Parent children management">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Children Management</h1>
          <Badge>Household {householdId ?? "Unknown"}</Badge>
        </div>
        <p>Create child profiles and link login accounts for child sign-in.</p>
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Add Child</h2>
        </div>
        <form className="children-form" onSubmit={(event) => void handleCreateChild(event)}>
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
        {submitError !== null ? <InlineNotice variant="error">Could not save child: {submitError}</InlineNotice> : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Link Child Login</h2>
        </div>
        <form className="children-form" onSubmit={(event) => void handleCreateChildAccount(event)}>
          <FormField label="Child">
            <select
              className="text-input"
              value={selectedChildId ?? ""}
              onChange={(event) => setSelectedChildId(event.target.value.length > 0 ? Number(event.target.value) : null)}
              disabled={linkingAccount || state.children.length === 0}
            >
              {state.children.length === 0 ? <option value="">No children found</option> : null}
              {state.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} {child.active ? "" : "(inactive)"}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Child Email (optional)">
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
          <Button type="submit" disabled={linkingAccount || state.children.length === 0}>
            {linkingAccount ? "Linking..." : "Create Linked Child Login"}
          </Button>
        </form>
        {linkAccountError !== null ? (
          <InlineNotice variant="error">Could not link child login: {linkAccountError}</InlineNotice>
        ) : null}
        {linkAccountSuccess !== null ? <InlineNotice>{linkAccountSuccess}</InlineNotice> : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Reset Child Login Email</h2>
        </div>
        <form className="children-form" onSubmit={(event) => void handleResetChildEmail(event)}>
          <FormField label="Child">
            <select
              className="text-input"
              value={selectedChildId ?? ""}
              onChange={(event) => setSelectedChildId(event.target.value.length > 0 ? Number(event.target.value) : null)}
              disabled={resettingEmail || state.children.length === 0}
            >
              {state.children.length === 0 ? <option value="">No children found</option> : null}
              {state.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} {child.active ? "" : "(inactive)"}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="New Email (optional, leave blank to auto-generate)">
            <TextInput
              type="email"
              value={resetEmailInput}
              onChange={(event) => setResetEmailInput(event.target.value)}
              placeholder="kid+new@example.com"
              disabled={resettingEmail}
            />
          </FormField>
          <Button type="submit" disabled={resettingEmail || state.children.length === 0}>
            {resettingEmail ? "Resetting..." : "Reset Child Email"}
          </Button>
        </form>
        {resetEmailError !== null ? (
          <InlineNotice variant="error">Could not reset child email: {resetEmailError}</InlineNotice>
        ) : null}
        {resetEmailSuccess !== null ? <InlineNotice>{resetEmailSuccess}</InlineNotice> : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Children</h2>
        </div>

        {state.loading ? <p>Loading children...</p> : null}
        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">Could not load children: {state.error}</InlineNotice>
        ) : null}

        {!state.loading && state.error === null && state.children.length === 0 ? (
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
                    <p className="balance-meta">{child.active ? "Active" : "Inactive"}</p>
                  </div>
                  <Button onClick={() => void handleToggleActive(child)} disabled={isUpdating}>
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
