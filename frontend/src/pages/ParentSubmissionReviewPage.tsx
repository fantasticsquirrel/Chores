import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  ApiClientError,
  apiClient,
  type SubmissionItemDecisionRequest,
  type SubmissionReview,
} from "../api";
import { Badge, Button, Card, InlineNotice } from "../ui";

type PageState = {
  submissions: SubmissionReview[];
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

export function ParentSubmissionReviewPage(): ReactElement {
  const [state, setState] = useState<PageState>({
    submissions: [],
    loading: true,
    error: null,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  async function loadSubmissions(): Promise<void> {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const submissions = await apiClient.listSubmissions({
        status: "PENDING",
      });
      setState({ submissions, loading: false, error: null });
    } catch (error: unknown) {
      setState({
        submissions: [],
        loading: false,
        error: formatApiError(error),
      });
    }
  }

  useEffect(() => {
    void loadSubmissions();
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
    setSubmittingKey(`approve-all-${submissionId}`);
    setActionError(null);

    try {
      await apiClient.approveSubmission(submissionId);
      await loadSubmissions();
    } catch (error: unknown) {
      setActionError(formatApiError(error));
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleItemDecision(
    submissionId: number,
    itemId: number,
    payload: SubmissionItemDecisionRequest,
  ): Promise<void> {
    setSubmittingKey(`item-${itemId}`);
    setActionError(null);

    try {
      await apiClient.decideSubmissionItem(submissionId, itemId, payload);
      await loadSubmissions();
    } catch (error: unknown) {
      setActionError(formatApiError(error));
    } finally {
      setSubmittingKey(null);
    }
  }

  return (
    <section className="dashboard-grid" aria-label="Parent submission review">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Submission Review</h1>
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
          </InlineNotice>
        ) : null}

        {!state.loading &&
        state.error === null &&
        state.submissions.length === 0 ? (
          <p>No pending submissions right now.</p>
        ) : null}

        {!state.loading &&
        state.error === null &&
        state.submissions.length > 0 ? (
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
                      disabled={submittingKey !== null}
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
                                submittingKey !== null ||
                                item.status === "APPROVED"
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
                                submittingKey !== null ||
                                item.status === "REJECTED"
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

        {actionError !== null ? (
          <InlineNotice variant="error">
            Could not update submission decision: {actionError}
          </InlineNotice>
        ) : null}
      </Card>
    </section>
  );
}
