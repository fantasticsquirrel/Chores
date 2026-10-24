import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type { SubmissionReview, SubmissionReviewItem } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { useModuleAccess } from "../../modules/ModuleAccessContext";
import { cardStyles } from "../../styles/cards";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
import { formatError } from "../../utils/format";

export function ParentReviewScreen() {
  const actionLock = useRef(false);
  const refreshing = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);
  const { canManageRef } = useModuleAccess();
  const [submissions, setSubmissions] = useState<SubmissionReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async (afterSave = false) => {
    const request = ++requestId.current;
    refreshing.current = true;
    setLoading(true);
    setError(null);
    try {
      const pending = await apiClient.listSubmissions({ status: "PENDING" });
      if (request !== requestId.current) return;
      setSubmissions(pending);
    } catch (refreshError) {
      if (request !== requestId.current) return;
      setError(`${afterSave ? "Decision saved, but refresh failed. Tap Refresh to update the queue. " : ""}${formatError(refreshError)}`);
    } finally {
      if (request === requestId.current) { refreshing.current = false; setLoading(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const requests = requestId;
    return () => { mounted.current = false; requests.current += 1; };
  }, [refresh]);

  async function approveAll(submissionId: number) {
    if (!canManageRef.current || actionLock.current || refreshing.current) return;
    actionLock.current = true;
    setActionId(`submission-${submissionId}`);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.approveSubmission(submissionId);
      if (!mounted.current) return;
      setSuccess("Submission approved.");
      setSubmissions((current) => current.filter((row) => row.id !== submissionId));
      await refresh(true);
    } catch (approvalError) {
      setError(formatError(approvalError));
    } finally {
      actionLock.current = false;
      setActionId(null);
    }
  }

  async function decideItem(
    submissionId: number,
    item: SubmissionReviewItem,
    status: "APPROVED" | "REJECTED",
  ) {
    if (!canManageRef.current || actionLock.current || refreshing.current) return;
    actionLock.current = true;
    setActionId(`item-${item.id}-${status}`);
    setError(null);
    setSuccess(null);
    try {
      const updated = await apiClient.decideSubmissionItem(submissionId, item.id, { status });
      if (!mounted.current) return;
      setSubmissions((current) => current.map((row) => row.id === submissionId ? updated : row).filter((row) => row.status === "PENDING"));
      setSuccess(status === "APPROVED" ? "Chore approved." : "Chore rejected.");
      await refresh(true);
    } catch (decisionError) {
      setError(formatError(decisionError));
    } finally {
      actionLock.current = false;
      setActionId(null);
    }
  }

  return (
    <View>
      <ScreenHeader
        subtitle="Pending child submissions"
        title="Review"
        trailing={
          <ActionButton
            compact
            disabled={loading || actionId !== null}
            label={loading ? "Refreshing" : "Refresh"}
            onPress={() => refresh()}
            variant="secondary"
          />
        }
      />
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      {success !== null ? <InlineNotice tone="success" message={success} /> : null}
      {loading && submissions.length === 0 ? (
        <SectionCard title="Pending">
          <LoadingRow label="Loading submissions" />
        </SectionCard>
      ) : submissions.length === 0 && error === null ? (
        <SectionCard title="Pending">
          <Text style={shellStyles.mutedText}>No pending submissions.</Text>
        </SectionCard>
      ) : (
        submissions.map((submission) => (
          <SectionCard
            key={submission.id}
            subtitle={`${submission.child_name} · ${submission.for_date}`}
            title={`Submission #${submission.id}`}
          >
            {submission.items.map((item) => (
              <View key={item.id} style={cardStyles.reviewItem}>
                <View style={formStyles.rowMain}>
                  <Text style={formStyles.rowTitle}>{item.chore_name}</Text>
                  <Text style={formStyles.rowMeta}>{item.status}</Text>
                </View>
                <View style={cardStyles.itemButtonRow}>
                  <ActionButton
                    compact
                    disabled={actionId !== null || loading || item.status !== "PENDING"}
                    label="Approve"
                    requiresManage
                    onPress={() => decideItem(submission.id, item, "APPROVED")}
                    variant="secondary"
                  />
                  <ActionButton
                    compact
                    disabled={actionId !== null || loading || item.status !== "PENDING"}
                    label="Reject"
                    requiresManage
                    onPress={() => decideItem(submission.id, item, "REJECTED")}
                    variant="danger"
                  />
                </View>
              </View>
            ))}
            <ActionButton
              disabled={actionId !== null || loading}
              label={
                actionId === `submission-${submission.id}`
                  ? "Approving..."
                  : "Approve all"
              }
              onPress={() => approveAll(submission.id)}
              requiresManage
            />
          </SectionCard>
        ))
      )}
    </View>
  );
}
