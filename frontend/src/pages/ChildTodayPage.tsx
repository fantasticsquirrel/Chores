import type { ChangeEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import { ApiClientError, apiClient, type EligibleChore } from "../api";
import { Badge, Button, Card, DateInput, FormField, InlineNotice } from "../ui";

type PageState = {
  chores: EligibleChore[];
  loading: boolean;
  error: string | null;
};

function formatApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

function toUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function buildTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChildTodayPage(): ReactElement {
  const [targetDate, setTargetDate] = useState(buildTodayIsoDate);
  const [state, setState] = useState<PageState>({
    chores: [],
    loading: true,
    error: null,
  });
  const [selectedChoreIds, setSelectedChoreIds] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadChores(date: string): Promise<void> {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const chores = await apiClient.listEligibleChores({ date });
      setState({ chores, loading: false, error: null });
      setSelectedChoreIds((previous) => previous.filter((choreId) => chores.some((chore) => chore.chore_id === choreId)));
    } catch (error: unknown) {
      setState({ chores: [], loading: false, error: formatApiError(error) });
      setSelectedChoreIds([]);
    }
  }

  useEffect(() => {
    void loadChores(targetDate);
  }, [targetDate]);

  function toggleSelection(choreId: number): void {
    setSelectedChoreIds((previous) =>
      previous.includes(choreId)
        ? previous.filter((id) => id !== choreId)
        : [...previous, choreId],
    );
  }

  async function handleSubmit(): Promise<void> {
    if (selectedChoreIds.length === 0) {
      setSubmitError("Select at least one chore to submit.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await apiClient.createSubmission({
        for_date: targetDate,
        chore_ids: selectedChoreIds,
      });
      setSubmitSuccess(`Submitted ${selectedChoreIds.length} chore(s) for review.`);
      setSelectedChoreIds([]);
      await loadChores(targetDate);
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDateChange(event: ChangeEvent<HTMLInputElement>): void {
    setTargetDate(event.target.value);
    setSubmitError(null);
    setSubmitSuccess(null);
  }

  return (
    <section className="dashboard-grid" aria-label="Child today page">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Child Today</h1>
          <Badge>Daily Chores</Badge>
        </div>
        <p>Select completed chores and submit them for parent approval.</p>
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Eligible Chores</h2>
        </div>
        <form className="children-form today-controls" onSubmit={(event) => event.preventDefault()}>
          <FormField label="Date">
            <DateInput
              value={targetDate}
              onChange={handleDateChange}
              max="9999-12-31"
            />
          </FormField>
          <Button onClick={() => void loadChores(targetDate)} disabled={state.loading}>
            {state.loading ? "Refreshing..." : "Refresh"}
          </Button>
        </form>

        {state.loading ? <p>Loading eligible chores...</p> : null}
        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">Could not load chores: {state.error}</InlineNotice>
        ) : null}
        {!state.loading && state.error === null && state.chores.length === 0 ? (
          <p>No eligible chores for this date.</p>
        ) : null}

        {!state.loading && state.error === null && state.chores.length > 0 ? (
          <ul className="balance-list" aria-label="Eligible chores list">
            {state.chores.map((chore) => (
              <li key={chore.chore_id} className="balance-item">
                <label className="checkbox-row task-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedChoreIds.includes(chore.chore_id)}
                    onChange={() => toggleSelection(chore.chore_id)}
                    disabled={submitting}
                  />
                  <span>
                    <span className="balance-name">{chore.name}</span>
                    <span className="balance-meta">
                      {toUsd(chore.reward_cents)} reward
                      {chore.expires_on != null ? ` • Expires ${chore.expires_on}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Submission</h2>
          <Badge>{selectedChoreIds.length} selected</Badge>
        </div>
        <Button
          onClick={() => void handleSubmit()}
          disabled={submitting || state.loading || selectedChoreIds.length === 0}
        >
          {submitting ? "Submitting..." : "Submit Selected Chores"}
        </Button>
        {submitError !== null ? <InlineNotice variant="error">Could not submit chores: {submitError}</InlineNotice> : null}
        {submitSuccess !== null ? <InlineNotice variant="success">{submitSuccess}</InlineNotice> : null}
      </Card>
    </section>
  );
}
