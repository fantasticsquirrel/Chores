import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type { SubmissionReview, SubmissionReviewItem } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

export function ParentReviewScreen() {
  const [submissions, setSubmissions] = useState<SubmissionReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = await apiClient.listSubmissions({ status: "PENDING" });
      setSubmissions(pending);
    } catch (refreshError) {
      setError(formatError(refreshError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function approveAll(submissionId: number) {
    setActionId(`submission-${submissionId}`);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.approveSubmission(submissionId);
      setSuccess("Submission approved.");
      await refresh();
    } catch (approvalError) {
      setError(formatError(approvalError));
    } finally {
      setActionId(null);
    }
  }

  async function decideItem(
    submissionId: number,
    item: SubmissionReviewItem,
    status: "APPROVED" | "REJECTED",
  ) {
    setActionId(`item-${item.id}-${status}`);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.decideSubmissionItem(submissionId, item.id, { status });
      setSuccess(status === "APPROVED" ? "Chore approved." : "Chore rejected.");
      await refresh();
    } catch (decisionError) {
      setError(formatError(decisionError));
    } finally {
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
            disabled={loading}
            label={loading ? "Refreshing" : "Refresh"}
            onPress={refresh}
            variant="secondary"
          />
        }
      />
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      {success !== null ? <InlineNotice tone="success" message={success} /> : null}
      {loading ? (
        <SectionCard title="Pending">
          <LoadingRow label="Loading submissions" />
        </SectionCard>
      ) : submissions.length === 0 ? (
        <SectionCard title="Pending">
          <Text style={styles.mutedText}>No pending submissions.</Text>
        </SectionCard>
      ) : (
        submissions.map((submission) => (
          <SectionCard
            key={submission.id}
            subtitle={`${submission.child_name} · ${submission.for_date}`}
            title={`Submission #${submission.id}`}
          >
            {submission.items.map((item) => (
              <View key={item.id} style={styles.reviewItem}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.chore_name}</Text>
                  <Text style={styles.rowMeta}>{item.status}</Text>
                </View>
                <View style={styles.itemButtonRow}>
                  <ActionButton
                    compact
                    disabled={actionId !== null}
                    label="Approve"
                    onPress={() => decideItem(submission.id, item, "APPROVED")}
                    variant="secondary"
                  />
                  <ActionButton
                    compact
                    disabled={actionId !== null}
                    label="Reject"
                    onPress={() => decideItem(submission.id, item, "REJECTED")}
                    variant="danger"
                  />
                </View>
              </View>
            ))}
            <ActionButton
              disabled={actionId !== null}
              label={
                actionId === `submission-${submission.id}`
                  ? "Approving..."
                  : "Approve all"
              }
              onPress={() => approveAll(submission.id)}
            />
          </SectionCard>
        ))
      )}
    </View>
  );
}
