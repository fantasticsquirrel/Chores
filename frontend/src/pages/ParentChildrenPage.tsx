import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import { ApiClientError, apiClient, type Child } from "../api";

const DEFAULT_HOUSEHOLD_ID = 1;

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

  async function loadChildren(): Promise<void> {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const children = await apiClient.listChildren({ household_id: DEFAULT_HOUSEHOLD_ID });
      setState({ children, loading: false, error: null });
    } catch (error: unknown) {
      setState({ children: [], loading: false, error: formatLoadError(error) });
    }
  }

  useEffect(() => {
    void loadChildren();
  }, []);

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
      await apiClient.createChild({
        household_id: DEFAULT_HOUSEHOLD_ID,
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
    setUpdatingChildId(child.id);
    setSubmitError(null);

    try {
      await apiClient.updateChild(child.id, {
        household_id: DEFAULT_HOUSEHOLD_ID,
        active: !child.active,
      });
      await loadChildren();
    } catch (error: unknown) {
      setSubmitError(formatLoadError(error));
    } finally {
      setUpdatingChildId(null);
    }
  }

  return (
    <section className="dashboard-grid" aria-label="Parent children management">
      <article className="glass-card dashboard-panel">
        <div className="panel-header-row">
          <h1>Children Management</h1>
          <span className="pill">Household {DEFAULT_HOUSEHOLD_ID}</span>
        </div>
        <p>Create and update active status for children in this household.</p>
      </article>

      <article className="glass-card dashboard-panel">
        <div className="panel-header-row">
          <h2>Add Child</h2>
        </div>
        <form className="children-form" onSubmit={(event) => void handleCreateChild(event)}>
          <label>
            Name
            <input
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Avery"
              maxLength={255}
              disabled={submitting}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={activeOnCreate}
              onChange={(event) => setActiveOnCreate(event.target.checked)}
              disabled={submitting}
            />
            Active
          </label>
          <button type="submit" className="jewel-button button-reset" disabled={submitting}>
            {submitting ? "Saving..." : "Create Child"}
          </button>
        </form>
        {submitError !== null ? <p role="alert">Could not save child: {submitError}</p> : null}
      </article>

      <article className="glass-card dashboard-panel">
        <div className="panel-header-row">
          <h2>Children</h2>
        </div>

        {state.loading ? <p>Loading children...</p> : null}
        {!state.loading && state.error !== null ? <p role="alert">Could not load children: {state.error}</p> : null}

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
                  <button
                    type="button"
                    className="jewel-button button-reset"
                    onClick={() => void handleToggleActive(child)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Updating..." : buttonLabel}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>
    </section>
  );
}
