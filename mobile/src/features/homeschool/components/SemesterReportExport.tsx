import { useEffect, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import { apiClient } from "../../../api/client";
import { ActionButton } from "../../../components/ActionButton";
import { InlineNotice } from "../../../components/InlineNotice";
import { shellStyles } from "../../../styles/shell";
import { formatError } from "../../../utils/format";
import { shareSemesterReport } from "../lib/shareSemesterReport";

export function SemesterReportExport({
  householdId,
  childId,
  semesterId,
}: {
  householdId: number;
  childId: number | null;
  semesterId: number | null;
}) {
  const [includeNotes, setIncludeNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const scope = `${householdId}:${childId}:${semesterId}`;
  const latestScope = useRef(scope);
  latestScope.current = scope;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setIncludeNotes(false);
    setError(null);
    setMessage(null);
  }, [scope]);
  async function exportReport() {
    if (locked.current || childId === null || semesterId === null) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    const authGeneration = apiClient.authenticationGeneration;
    const current = () =>
      mounted.current &&
      latestScope.current === scope &&
      authGeneration === apiClient.authenticationGeneration;
    try {
      const report = await apiClient.downloadHomeschoolSemesterReport({
        household_id: householdId,
        child_id: childId,
        semester_id: semesterId,
        include_notes: includeNotes,
      });
      if (!current()) return;
      await shareSemesterReport(report, current);
      if (current()) setMessage("PDF prepared and share sheet opened.");
    } catch (cause) {
      if (current()) setError(formatError(cause));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View style={shellStyles.compactStack}>
      <Text style={shellStyles.mutedText}>
        A concise attendance summary and any recorded grades for this child and
        semester.
      </Text>
      <View style={shellStyles.splitRow}>
        <Text style={shellStyles.mutedText}>Include notes</Text>
        <Switch
          accessibilityLabel="Include notes in semester PDF"
          value={includeNotes}
          disabled={busy}
          onValueChange={setIncludeNotes}
        />
      </View>
      <ActionButton
        label={busy ? "Preparing PDF..." : "Export semester PDF"}
        disabled={busy || childId === null || semesterId === null}
        onPress={() => {
          void exportReport();
        }}
      />
      {error ? <InlineNotice tone="error" message={error} /> : null}
      {message ? <InlineNotice message={message} /> : null}
    </View>
  );
}
