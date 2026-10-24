import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  apiClient,
  type SubmissionItemDecisionRequest,
  type SubmissionReview,
} from "../api";
import { formatApiError } from "../lib/errors";
import { Badge, Button, Card, InlineNotice } from "../ui";

type PageState = {
  submissions: SubmissionReview[];
  loading: boolean;
  error: string | null;
};

export function ParentSubmissionReviewPage(): ReactElement {
  const [state, setState] = useState<PageState>({
    submissions: [],
    loading: true,
    error: null,
  });
  const actionLock = useRef(false);
  const refreshing = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  async function loadSubmissions(afterSave = false): Promise<void> {
    const request = ++requestId.current;
    refreshing.current = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const submissions = await apiClient.listSubmissions({
        status: "PENDING",
      });
      if (request !== requestId.current) return;
      setState({ submissions, loading: false, error: null });
    } catch (error: unknown) {
      if (request !== requestId.current) return;
      setState((previous) => ({
        ...previous,
        loading: false,
        error: `${afterSave ? "Decision saved, but refresh failed. Retry to update the remaining queue. " : ""}${formatApiError(error)}`,
      }));
    } finally {
      if (request === requestId.current) refreshing.current = false;
    }
  }

  useEffect(() => {
    mounted.current = true;
    void loadSubmissions();
    const requests = requestId;
    return () => { mounted.current = false; requests.current += 1; };
  }, []);

  const pendingItemsCount = useMemo(
    () =>
      state.submissions.reduce(
        (count, submission) =>
          count +
          submission.items.filter((item) => item.status === "PENDING").length,
        0,
      ),
    [state.submissions],
  );

  async function handleApproveAll(submissionId: number): Promise<void> {
    if (actionLock.current || refreshing.current) return;
    actionLock.current = true;
    setSaved(false);
    setSubmittingKey(`approve-all-${submissionId}`);
    setActionError(null);

    try {
      await apiClient.approveSubmission(submissionId);
      if (!mounted.current) return;
      setSaved(true);
      setState((previous) => ({ ...previous, submissions: previous.submissions.filter((row) => row.id !== submissionId) }));
      await loadSubmissions(true);
    } catch (error: unknown) {
      setActionError(formatApiError(error));
    } finally {
      actionLock.current = false;
      setSubmittingKey(null);
    }
  }

  async function handleItemDecision(
    submissionId: number,
    itemId: number,
    payload: SubmissionItemDecisionRequest,
  ): Promise<void> {
    if (actionLock.current || refreshing.current) return;
    actionLock.current = true;
    setSaved(false);
    setSubmittingKey(`item-${itemId}`);
    setActionError(null);

    try {
      const updated = await apiClient.decideSubmissionItem(submissionId, itemId, payload);
      if (!mounted.current) return;
      setSaved(true);
      setState((previous) => ({ ...previous, submissions: previous.submissions
        .map((row) => row.id === submissionId ? updated : row)
        .filter((row) => row.status === "PENDING") }));
      await loadSubmissions(true);
    } catch (error: unknown) {
      setActionError(formatApiError(error));
    } finally {
      actionLock.current = false;
      setSubmittingKey(null);
    }
  }

  return (
    <section className="dashboard-grid" aria-label="Parent submission review">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Review</h1>
          <Badge>{pendingItemsCount} pending item(s)</Badge>
        </div>
        <p>
          Approve all chores in a submission or decide each item individually.
        </p>
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Pending Submissions</h2>
        </div>

        {state.loading ? <p>Loading pending submissions...</p> : null}
        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">
            Could not load submissions: {state.error}
            <Button onClick={() => void loadSubmissions(saved)} disabled={state.loading || submittingKey !== null}>Retry</Button>
          </InlineNotice>
        ) : null}

        {!state.loading &&
        state.error === null &&
        state.submissions.length === 0 ? (
          <p>No pending submissions right now.</p>
        ) : null}

        {state.submissions.length > 0 ? (
          <ul className="submission-list" aria-label="Pending submissions list">
            {state.submissions.map((submission) => {
              const approvingAll =
                submittingKey === `approve-all-${submission.id}`;

              return (
                <li key={submission.id} className="submission-item">
                  <div className="panel-header-row">
                    <div>
                      <p className="balance-name">{submission.child_name}</p>
                      <p className="balance-meta">
                        For {submission.for_date} • {submission.items.length}{" "}
                        item(s)
                      </p>
                    </div>
                    <Button
                      onClick={() => void handleApproveAll(submission.id)}
                      disabled={submittingKey !== null || state.loading}
                    >
                      {approvingAll ? "Approving..." : "Approve All"}
                    </Button>
                  </div>

                  <ul
                    className="balance-list"
                    aria-label={`Submission ${submission.id} items`}
                  >
                    {submission.items.map((item) => {
                      const itemActionPending =
                        submittingKey === `item-${item.id}`;
                      const itemStatusClass =
                        item.status === "APPROVED"
                          ? "item-status approved"
                          : item.status === "REJECTED"
                            ? "item-status rejected"
                            : "item-status";

                      return (
                        <li key={item.id} className="balance-item">
                          <div>
                            <p className="balance-name">{item.chore_name}</p>
                          </div>
                          <div className="item-actions">
                            <span className={itemStatusClass}>
                              {item.status}
                            </span>
                            <Button
                              onClick={() =>
                                void handleItemDecision(
                                  submission.id,
                                  item.id,
                                  {
                                    status: "APPROVED",
                                  },
                                )
                              }
                              disabled={
                                submittingKey !== null || state.loading ||
                                item.status !== "PENDING"
                              }
                            >
                              {itemActionPending ? "Saving..." : "Approve"}
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() =>
                                void handleItemDecision(
                                  submission.id,
                                  item.id,
                                  {
                                    status: "REJECTED",
                                  },
                                )
                              }
                              disabled={
                                submittingKey !== null || state.loading ||
                                item.status !== "PENDING"
                              }
                            >
                              {itemActionPending ? "Saving..." : "Reject"}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : null}

        {saved && state.error === null ? <InlineNotice variant="success">Decision saved.</InlineNotice> : null}
        {actionError !== null ? (
          <InlineNotice variant="error">
            Could not update submission decision: {actionError}
          </InlineNotice>
        ) : null}
      </Card>
    </section>
  );
}
