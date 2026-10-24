import type { ReactElement } from "react";

import type { Child, HomeschoolAttendance, HomeschoolDayComment, HomeschoolSubject } from "../../api";
import { Button, Card, FormField } from "../../ui";
import { buildMonthGrid, formatYearMonth, shiftYearMonth, todayISO, toYearMonth } from "./dateUtils";

type AttendanceCalendarProps = {
  saving: boolean;
  canManage: boolean;
  calendarYearMonth: string;
  calendarChildId: string;
  children: Child[];
  selectedChildAttendance: HomeschoolAttendance[];
  selectedChildComments: HomeschoolDayComment[];
  subjects: HomeschoolSubject[];
  selectedDate: string | null;
  onMonthChange: (yearMonth: string) => void;
  onChildChange: (childId: string) => void;
  onDaySelect: (date: string, comment: string) => void;
  onClearAttendance: (attendanceId: number) => void;
  onClearDayComment: (commentId: number) => void;
};

export function AttendanceCalendar({
  saving,
  canManage,
  calendarYearMonth,
  calendarChildId,
  children,
  selectedChildAttendance,
  selectedChildComments,
  subjects,
  selectedDate,
  onMonthChange,
  onChildChange,
  onDaySelect,
  onClearAttendance,
  onClearDayComment,
}: AttendanceCalendarProps): ReactElement {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const monthCells = buildMonthGrid(calendarYearMonth);
  const calendarLabel = formatYearMonth(calendarYearMonth);
  const selectedMonthRecords = selectedChildAttendance.filter(
    (record) => record.present && record.date.startsWith(calendarYearMonth),
  );
  const subjectRows = subjects.map((subject) => ({
    subject,
    days: new Set(
      selectedMonthRecords.filter((record) => record.subject_id === subject.id).map((record) => record.date),
    ).size,
    entries: selectedMonthRecords.filter((record) => record.subject_id === subject.id).length,
  }));
  const activeSubjectRows = subjectRows.filter((row) => row.entries > 0);

  return (
    <Card className="dashboard-panel homeschool-calendar">
      <div className="panel-header-row">
        <h2>Attendance Calendar</h2>
        <div className="quick-actions homeschool-calendar-navigation">
          <Button type="button" disabled={saving} onClick={() => onMonthChange(shiftYearMonth(calendarYearMonth, -1))}>Previous</Button>
          <Button type="button" disabled={saving} onClick={() => onMonthChange(toYearMonth(todayISO()))}>Today</Button>
          <Button type="button" disabled={saving} onClick={() => onMonthChange(shiftYearMonth(calendarYearMonth, 1))}>Next</Button>
        </div>
      </div>
      <FormField label="Child" className="homeschool-calendar-child">
        <select disabled={saving} className="text-input" value={calendarChildId} onChange={(event) => onChildChange(event.target.value)}>
          <option value="">Select child</option>
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </FormField>
      <h3>{calendarLabel}</h3>
      <p className="calendar-instructions">
        {!canManage ? "View attendance for the selected child." : calendarChildId === "" ? "Select a child to record attendance." : "Tap or click a date to record attendance."}
      </p>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="eyebrow calendar-weekday">{day}</div>
        ))}
        {monthCells.map((cell) => {
          const records = selectedChildAttendance.filter((record) => record.date === cell.iso);
          const comment = selectedChildComments.find((entry) => entry.date === cell.iso);
          return (
            <button
              key={cell.iso}
              type="button"
              className={`glass-card button-reset calendar-day${cell.inMonth ? "" : " muted"}${selectedDate === cell.iso ? " selected" : ""}`}
              disabled={!canManage || saving || !cell.inMonth || calendarChildId === ""}
              aria-label={`${cell.iso}${records.length > 0 ? `, ${records.length} attendance ${records.length === 1 ? "entry" : "entries"}` : ", no attendance recorded"}`}
              aria-pressed={selectedDate === cell.iso}
              onClick={() => onDaySelect(cell.iso, comment?.comment || "")}
            >
              <strong className="calendar-day-number">{cell.day}{comment?.comment ? " ★" : ""}</strong>
              {records.length > 0 ? (
                <div className="calendar-subject-labels">
                {records.slice(0, 3).map((record) => {
                  const subject = subjectLookup.get(record.subject_id);
                  return (
                    <span key={record.id} className="calendar-subject-initial" title={`${subject?.name || `Subject ${record.subject_id}`}: ${record.present ? "Present" : "Absent"}`} style={{ borderColor: subject?.color || undefined }}>
                      {record.present ? (subject?.name || `S${record.subject_id}`).slice(0, 1).toUpperCase() : "–"}
                    </span>
                  );
                })}
                  {records.length > 3 ? <span className="eyebrow">+{records.length - 3}</span> : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeSubjectRows.length > 0 ? (
        <div className="subject-attendance-strip" aria-label="Subject attendance totals">
          {activeSubjectRows.map((row) => (
            <div key={row.subject.id} className="subject-attendance-card">
              <span className="subject-attendance-color" style={{ background: row.subject.color }} />
              <div>
                <p className="balance-name">{row.subject.name}</p>
                <p className="balance-meta">{row.days} day{row.days === 1 ? "" : "s"} · {row.entries} entr{row.entries === 1 ? "y" : "ies"}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {selectedChildComments.length > 0 ? (
        <ul className="balance-list" aria-label="Day comments">
          {selectedChildComments.map((comment) => (
            <li key={comment.id} className="balance-item">
              <div>
                <p className="balance-name">{comment.date}</p>
                <p className="balance-meta">{comment.comment}</p>
              </div>
              <Button type="button" onClick={() => onClearDayComment(comment.id)}>Clear</Button>
            </li>
          ))}
        </ul>
      ) : null}
      <details className="homeschool-log">
        <summary>Attendance log ({selectedChildAttendance.length})</summary>
      {selectedChildAttendance.length > 0 ? (
        <ul className="balance-list" aria-label="Attendance entries">
          {selectedChildAttendance.map((record) => {
            const subject = subjectLookup.get(record.subject_id);
            return (
              <li key={record.id} className="balance-item">
                <div>
                  <p className="balance-name">{record.date} · {subject?.name || `Subject ${record.subject_id}`}</p>
                  <p className="balance-meta">{record.present ? "Present" : "Absent"} · {record.comment || "No comment"}</p>
                </div>
                <Button type="button" onClick={() => onClearAttendance(record.id)}>Clear</Button>
              </li>
            );
          })}
        </ul>
      ) : <p>No attendance recorded yet.</p>}
      </details>
    </Card>
  );
}
