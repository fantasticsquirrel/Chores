import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { apiClient, type HomeschoolAttendance, type HomeschoolSubject } from "../../../api";
import { formatApiError } from "../../../lib/errors";
import { Button, FormField, TextInput } from "../../../ui";
import { previousAttendance } from "../lib/attendance";
import "../homeschool.css";

type Entry = { selected: boolean; present: boolean; comment: string };
type Props = {
  householdId: number;
  childId: number;
  childName: string;
  date: string;
  subjects: HomeschoolSubject[];
  records: HomeschoolAttendance[];
  onClose: () => void;
  onSaved: () => void | Promise<void | boolean>;
  onSavingChange?: (saving: boolean) => void;
  onRecordSaved?: (record: HomeschoolAttendance) => void;
  externallySaving?: boolean;
};

function readableAttendanceDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function AttendanceDialog({ householdId, childId, childName, date, subjects, records, onClose, onSaved, onSavingChange, onRecordSaved, externallySaving = false }: Props): ReactElement {
  const scopedRecords = records.filter((row) => row.household_id === householdId && row.child_id === childId);
  const scopedSubjects = subjects.filter((subject) => subject.household_id === householdId);
  const buildEntries = () => Object.fromEntries(scopedSubjects.map((subject) => {
    const existing = scopedRecords.find((row) => row.date === date && row.subject_id === subject.id);
    return [subject.id, { selected: existing !== undefined, present: existing?.present ?? true, comment: existing?.comment ?? "" }];
  }));
  const [entries, setEntries] = useState<Record<number, Entry>>(buildEntries);
  const waitingForPrevious = useRef(externallySaving);
  useEffect(() => {
    if (waitingForPrevious.current && !externallySaving) {
      waitingForPrevious.current = false;
      setEntries(Object.fromEntries(subjects.filter((subject) => subject.household_id === householdId).map((subject) => {
        const existing = records.find((row) => row.household_id === householdId && row.child_id === childId && row.date === date && row.subject_id === subject.id);
        return [subject.id, { selected: existing !== undefined, present: existing?.present ?? true, comment: existing?.comment ?? "" }];
      })));
    }
  }, [externallySaving, subjects, records, householdId, childId, date]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const saved = useRef(new Map<number, string>());
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (element && typeof element.showModal === "function") element.showModal();
    else element?.setAttribute("open", "");
    element?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      document.body.style.overflow = overflow;
      if (element && typeof element.close === "function") element.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  function change(subjectId: number, patch: Partial<Entry>): void {
    setEntries((current) => ({ ...current, [subjectId]: { ...(current[subjectId] ?? { selected: false, present: true, comment: "" }), ...patch } }));
    setError(null);
  }

  function copyPrevious(): void {
    const previous = previousAttendance(scopedRecords, householdId, childId, date);
    if (previous.length === 0) {
      setCopyMessage("No earlier attendance for this child. Select subjects below to start a new day.");
      return;
    }
    const omitted = previous.filter((row) => !scopedSubjects.some((subject) => subject.id === row.subject_id));
    const copied = previous.filter((row) => scopedSubjects.some((subject) => subject.id === row.subject_id));
    setEntries(Object.fromEntries(scopedSubjects.map((subject) => {
      const record = copied.find((row) => row.subject_id === subject.id);
      return [subject.id, { selected: record !== undefined, present: record?.present ?? true, comment: record?.comment ?? "" }];
    })));
    setCopyMessage(`Copied ${previous[0].date}. Review and edit before saving.${copied.length < previous.length ? ` Not copied (unavailable): ${omitted.map((row) => subjects.find((subject) => subject.id === row.subject_id)?.name ?? `Subject ${row.subject_id}`).join(", ")}. Their existing records are unchanged.` : ""}`);
    setError(null);
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy.current || success || externallySaving) return;
    const selected = scopedSubjects.filter((subject) => entries[subject.id]?.selected);
    if (selected.length === 0) return;
    busy.current = true;
    setSaving(true);
    onSavingChange?.(true);
    setError(null);
    setCopyMessage(null);
    const pending = selected.filter((subject) => saved.current.get(subject.id) !== JSON.stringify(entries[subject.id]));
    const outcomes = await Promise.all(pending.map(async (subject) => {
      const entry = entries[subject.id];
      try {
        const record = await apiClient.upsertHomeschoolAttendance({ household_id: householdId, child_id: childId, subject_id: subject.id, date, present: entry.present, comment: entry.comment });
        onRecordSaved?.(record);
        saved.current.set(subject.id, JSON.stringify(entry));
        return null;
      } catch (reason: unknown) {
        return `${subject.name}: ${formatApiError(reason)}`;
      }
    }));
    // All requests were submitted for one immutable child/date snapshot. Back or
    // navigation may unmount this dialog; never update or close its replacement.
    const failed = outcomes.filter((outcome): outcome is string => outcome !== null);
    try {
      const refreshed = await onSaved();
      if (refreshed === false) throw new Error("Records could not be reloaded. Saved changes have not been rolled back.");
    } catch (reason: unknown) {
      onSavingChange?.(false);
      if (mounted.current) {
        setError(`${selected.length - failed.length} subject saved; ${failed.length} could not be saved. Could not refresh records: ${formatApiError(reason)}. Retry to refresh; unchanged saved subjects will not be sent again.`);
        setSaving(false); busy.current = false;
      }
      return;
    }
    onSavingChange?.(false);
    if (!mounted.current) return;
    setSaving(false);
    busy.current = false;
    if (failed.length > 0) {
      setError(`${selected.length - failed.length} subject saved; ${failed.length} could not be saved. ${failed.join(" ")} Review or retry; unchanged saved subjects will not be sent again.`);
      return;
    }
    setSuccess(true);
    timer.current = setTimeout(() => { if (mounted.current) close.current(); }, 2500);
  }

  const locked = saving || success || externallySaving;
  return createPortal(
    <dialog ref={dialog} className="homeschool-attendance-dialog" aria-modal="true" aria-labelledby="attendance-dialog-title" aria-describedby="attendance-dialog-context"
      onCancel={(event) => { event.preventDefault(); if (!busy.current && !externallySaving) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); if (!busy.current && !externallySaving) onClose(); }
        if (event.key !== "Tab") return;
        const focusable = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
        if (!focusable?.length) { event.preventDefault(); return; }
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className="panel-header-row homeschool-attendance-header">
        <div><h2 id="attendance-dialog-title">Attendance</h2><p id="attendance-dialog-context" className="homeschool-attendance-context">{childName} · {readableAttendanceDate(date)}</p></div>
        <Button className="homeschool-close-button" type="button" disabled={saving || externallySaving} onClick={onClose} aria-label="Close attendance editor"><span aria-hidden="true">×</span></Button>
      </div>
      <Button className="homeschool-secondary-button homeschool-copy-button" type="button" onClick={copyPrevious} disabled={locked || scopedSubjects.length === 0}>Copy previous day</Button>
      {copyMessage ? <p role="status">{copyMessage}</p> : null}
      {scopedRecords.some((record) => record.date === date && !scopedSubjects.some((subject) => subject.id === record.subject_id)) ? <p>Some entries on this date belong to unavailable subjects. Those records are preserved and can be reviewed in the attendance log.</p> : null}
      {externallySaving && !saving ? <p role="status">Finishing the previous save and reloading attendance…</p> : null}
      <form onSubmit={(event) => void save(event)}>
        <fieldset disabled={locked} className="homeschool-subject-entries">
          <legend>Subjects</legend>
          {scopedSubjects.length === 0 ? <p>Create a subject in Setup & Records first.</p> : scopedSubjects.map((subject) => {
            const entry = entries[subject.id] ?? { selected: false, present: true, comment: "" };
            return <div key={subject.id} className="homeschool-subject-entry">
              <label className="checkbox-row homeschool-subject-toggle"><input type="checkbox" aria-label={`Select ${subject.name}${subject.active ? "" : " (inactive)"}`} checked={entry.selected} onChange={(event) => change(subject.id, { selected: event.target.checked })} /><span className="subject-attendance-color" style={{ background: subject.color }} /><span>{subject.name}{subject.active ? "" : " (inactive)"}</span></label>
              {entry.selected ? <div className="homeschool-attendance-fields">
                <label className="checkbox-row homeschool-presence-control"><input type="checkbox" aria-label={`${subject.name} present`} checked={entry.present} onChange={(event) => change(subject.id, { present: event.target.checked })} /><span>Present</span></label>
                <FormField label="Notes" className="homeschool-notes-control"><TextInput aria-label={`${subject.name} notes`} value={entry.comment} onChange={(event) => change(subject.id, { comment: event.target.value })} maxLength={2000} placeholder="What did you work on?" /></FormField>
              </div> : null}
            </div>;
          })}
        </fieldset>
        {error ? <p role="alert" className="homeschool-save-error">{error}</p> : null}
        {success ? <p role="status" className="homeschool-save-success">Attendance saved. Closing shortly…</p> : null}
        <div className="item-actions homeschool-attendance-actions">
          <Button type="submit" disabled={locked || !Object.values(entries).some((entry) => entry.selected)}>{saving ? "Saving…" : "Save"}</Button>
          <Button className="homeschool-secondary-button" type="button" onClick={onClose} disabled={saving || externallySaving}>Cancel</Button>
        </div>
      </form>
    </dialog>, document.body,
  );
}
