import { useEffect, useRef, useState, type ReactElement } from "react";
import { apiClient } from "../../../api";
import { formatApiError } from "../../../lib/errors";
import { Button } from "../../../ui";
import { downloadSemesterPdf } from "../lib/downloadReport";

type Props = { householdId: number; semesterId: number; childId: number };
export function SemesterReportExport({ householdId, semesterId, childId }: Props): ReactElement {
  const [includeNotes, setIncludeNotes] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  async function download(): Promise<void> {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setWorking(true); setMessage(null); setError(null);
    try {
      const report = await apiClient.downloadHomeschoolSemesterReport({ household_id: householdId, semester_id: semesterId, child_id: childId, include_notes: includeNotes }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      downloadSemesterPdf(report, semesterId, childId);
      setMessage("Semester PDF downloaded.");
    } catch (reason: unknown) {
      if (!controller.signal.aborted) setError(`Could not export the semester report: ${formatApiError(reason)}`);
    } finally {
      if (!controller.signal.aborted) { request.current = null; setWorking(false); }
    }
  }
  return <div className="homeschool-report-export">
    <label className="checkbox-row"><input type="checkbox" checked={includeNotes} disabled={working} onChange={(event) => setIncludeNotes(event.target.checked)} />Include attendance and day notes</label>
    <Button type="button" disabled={working} onClick={() => void download()}>{working ? "Preparing PDF…" : "Export Semester PDF"}</Button>
    <p className="balance-meta">Attendance summary and recorded semester grades. Notes are optional.</p>
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
