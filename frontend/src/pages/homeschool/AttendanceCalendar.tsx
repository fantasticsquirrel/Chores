import type { ReactElement } from "react";

import type { Child, HomeschoolAttendance, HomeschoolDayComment, HomeschoolSubject } from "../../api";
import { Button, Card, FormField } from "../../ui";
import { buildMonthGrid, formatYearMonth, shiftYearMonth, todayISO, toYearMonth } from "./dateUtils";

type AttendanceCalendarProps = {
  calendarYearMonth: string;
  calendarChildId: string;
  children: Child[];
  selectedChildAttendance: HomeschoolAttendance[];
  selectedChildComments: HomeschoolDayComment[];
  subjects: HomeschoolSubject[];
  onMonthChange: (yearMonth: string) => void;
  onChildChange: (childId: string) => void;
  onDaySelect: (date: string, comment: string) => void;
  onClearAttendance: (attendanceId: number) => void;
};

export function AttendanceCalendar({
  calendarYearMonth,
  calendarChildId,
  children,
  selectedChildAttendance,
  selectedChildComments,
  subjects,
  onMonthChange,
  onChildChange,
  onDaySelect,
  onClearAttendance,
}: AttendanceCalendarProps): ReactElement {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const monthCells = buildMonthGrid(calendarYearMonth);
  const calendarLabel = formatYearMonth(calendarYearMonth);

  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>Attendance Calendar</h2>
        <div className="quick-actions">
          <Button type="button" onClick={() => onMonthChange(shiftYearMonth(calendarYearMonth, -1))}>Previous</Button>
          <Button type="button" onClick={() => onMonthChange(toYearMonth(todayISO()))}>Today</Button>
          <Button type="button" onClick={() => onMonthChange(shiftYearMonth(calendarYearMonth, 1))}>Next</Button>
        </div>
      </div>
      <FormField label="Child">
        <select className="text-input" value={calendarChildId} onChange={(event) => onChildChange(event.target.value)}>
          <option value="">Select child</option>
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </FormField>
      <h3>{calendarLabel}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="eyebrow" style={{ textAlign: "center" }}>{day}</div>
        ))}
        {monthCells.map((cell) => {
          const records = selectedChildAttendance.filter((record) => record.date === cell.iso && record.present);
          const comment = selectedChildComments.find((entry) => entry.date === cell.iso);
          return (
            <button
              key={cell.iso}
              type="button"
              className="glass-card button-reset"
              style={{
                minHeight: 84,
                padding: 8,
                opacity: cell.inMonth ? 1 : 0.35,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                alignItems: "flex-start",
              }}
              onClick={() => onDaySelect(cell.iso, comment?.comment || "")}
            >
              <strong>{cell.day}{comment?.comment ? " ★" : ""}</strong>
              {records.slice(0, 3).map((record) => {
                const subject = subjectLookup.get(record.subject_id);
                return (
                  <span key={record.id} className="balance-pill" style={{ background: subject?.color || undefined }}>
                    {subject?.name || `Subject ${record.subject_id}`}
                  </span>
                );
              })}
              {records.length > 3 ? <span className="eyebrow">+{records.length - 3} more</span> : null}
            </button>
          );
        })}
      </div>

      {selectedChildAttendance.length > 0 ? (
        <ul className="balance-list" aria-label="Attendance entries">
          {selectedChildAttendance.map((record) => {
            const subject = subjectLookup.get(record.subject_id);
            return (
              <li key={record.id} className="balance-item">
                <div>
                  <p className="balance-name">{record.date} · {subject?.name || `Subject ${record.subject_id}`}</p>
                  <p className="balance-meta">{record.comment || "No comment"}</p>
                </div>
                <Button type="button" onClick={() => onClearAttendance(record.id)}>Clear</Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
