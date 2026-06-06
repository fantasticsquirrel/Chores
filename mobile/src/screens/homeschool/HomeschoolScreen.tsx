import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type {
  AuthSessionResponse,
  Child,
  FamilyModule,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { StatCard } from "../../components/StatCard";
import { hasModule } from "../../navigation/tabs";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

export function HomeschoolScreen({
  modules,
  session,
}: {
  modules: FamilyModule[];
  session: AuthSessionResponse;
}) {
  const homeschoolEnabled = hasModule(modules, "homeschool");
  const [children, setChildren] = useState<Child[]>([]);
  const [semesters, setSemesters] = useState<HomeschoolSemester[]>([]);
  const [subjects, setSubjects] = useState<HomeschoolSubject[]>([]);
  const [attendance, setAttendance] = useState<HomeschoolAttendance[]>([]);
  const [comments, setComments] = useState<HomeschoolDayComment[]>([]);
  const [grades, setGrades] = useState<HomeschoolGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!homeschoolEnabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const householdId = session.user.household_id;
      const [
        childRows,
        semesterRows,
        subjectRows,
        attendanceRows,
        commentRows,
        gradeRows,
      ] = await Promise.all([
        apiClient.listChildren({ household_id: householdId, active_only: true }),
        apiClient.listHomeschoolSemesters(householdId),
        apiClient.listHomeschoolSubjects(householdId),
        apiClient.listHomeschoolAttendance(householdId),
        apiClient.listHomeschoolDayComments(householdId),
        apiClient.listHomeschoolGrades(householdId),
      ]);
      setChildren(childRows);
      setSemesters(semesterRows);
      setSubjects(subjectRows);
      setAttendance(attendanceRows);
      setComments(commentRows);
      setGrades(gradeRows);
    } catch (refreshError) {
      setError(formatError(refreshError));
    } finally {
      setLoading(false);
    }
  }, [homeschoolEnabled, session.user.household_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!homeschoolEnabled) {
    return (
      <View>
        <ScreenHeader subtitle="Module summary" title="Homeschool" />
        <SectionCard title="Unavailable">
          <Text style={styles.mutedText}>
            Homeschool is not enabled for this account.
          </Text>
        </SectionCard>
      </View>
    );
  }

  const activeSubjects = subjects.filter((subject) => subject.active);
  const activeSemesters = semesters.filter((semester) => semester.active);
  const recentComments = comments.slice(0, 3);

  return (
    <View>
      <ScreenHeader
        subtitle="Compact school overview"
        title="Homeschool"
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
      <View style={styles.statGrid}>
        <StatCard label="Children" value={children.length.toString()} />
        <StatCard label="Subjects" value={activeSubjects.length.toString()} />
        <StatCard label="Attendance" value={attendance.length.toString()} />
        <StatCard label="Grades" value={grades.length.toString()} />
      </View>
      <SectionCard
        subtitle={
          activeSemesters.length > 0
            ? activeSemesters.map((semester) => semester.name).join(", ")
            : undefined
        }
        title="Active semesters"
      >
        <Text style={styles.mutedText}>
          {activeSemesters.length > 0
            ? `${activeSemesters.length} active semester record${
                activeSemesters.length === 1 ? "" : "s"
              }.`
            : "No active semester records."}
        </Text>
      </SectionCard>
      <SectionCard title="Recent comments">
        {loading ? (
          <LoadingRow label="Loading homeschool data" />
        ) : recentComments.length === 0 ? (
          <Text style={styles.mutedText}>No day comments yet.</Text>
        ) : (
          recentComments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <Text style={styles.rowTitle}>{comment.date}</Text>
              <Text style={styles.rowMeta} numberOfLines={3}>
                {comment.comment}
              </Text>
            </View>
          ))
        )}
      </SectionCard>
    </View>
  );
}
