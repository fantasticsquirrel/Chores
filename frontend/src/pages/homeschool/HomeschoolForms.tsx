import type { FormEvent, ReactElement } from "react";

import type { Child, HomeschoolSemester, HomeschoolSubject } from "../../api";
import { Button, Card, DateInput, FormField, TextInput } from "../../ui";

export type AttendanceFormState = {
  childId: string;
  subjectId: string;
  date: string;
  present: boolean;
  comment: string;
};

export type DayCommentFormState = {
  childId: string;
  date: string;
  comment: string;
};

export type GradeFormState = {
  childId: string;
  subjectId: string;
  semesterId: string;
  grade: string;
};

type HomeschoolFormsProps = {
  householdId: number | null;
  children: Child[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  subjectName: string;
  subjectColor: string;
  attendance: AttendanceFormState;
  dayComment: DayCommentFormState;
  grade: GradeFormState;
  onSemesterNameChange: (value: string) => void;
  onSemesterStartChange: (value: string) => void;
  onSemesterEndChange: (value: string) => void;
  onSubjectNameChange: (value: string) => void;
  onSubjectColorChange: (value: string) => void;
  onAttendanceChange: (patch: Partial<AttendanceFormState>) => void;
  onDayCommentChange: (patch: Partial<DayCommentFormState>) => void;
  onGradeChange: (patch: Partial<GradeFormState>) => void;
  onCreateSemester: (event: FormEvent<HTMLFormElement>) => void;
  onCreateSubject: (event: FormEvent<HTMLFormElement>) => void;
  onSaveAttendance: (event: FormEvent<HTMLFormElement>) => void;
  onSaveDayComment: (event: FormEvent<HTMLFormElement>) => void;
  onSaveGrade: (event: FormEvent<HTMLFormElement>) => void;
};

export function HomeschoolForms({
  householdId,
  children,
  semesters,
  subjects,
  semesterName,
  semesterStart,
  semesterEnd,
  subjectName,
  subjectColor,
  attendance,
  dayComment,
  grade,
  onSemesterNameChange,
  onSemesterStartChange,
  onSemesterEndChange,
  onSubjectNameChange,
  onSubjectColorChange,
  onAttendanceChange,
  onDayCommentChange,
  onGradeChange,
  onCreateSemester,
  onCreateSubject,
  onSaveAttendance,
  onSaveDayComment,
  onSaveGrade,
}: HomeschoolFormsProps): ReactElement {
  return (
    <>
      <Card className="dashboard-panel">
        <h2>Create Semester</h2>
        <form className="children-form" onSubmit={onCreateSemester}>
          <FormField label="Semester Name">
            <TextInput value={semesterName} onChange={(event) => onSemesterNameChange(event.target.value)} placeholder="Fall 2026" required maxLength={255} />
          </FormField>
          <FormField label="Start Date">
            <DateInput value={semesterStart} onChange={(event) => onSemesterStartChange(event.target.value)} required />
          </FormField>
          <FormField label="End Date">
            <DateInput value={semesterEnd} onChange={(event) => onSemesterEndChange(event.target.value)} required />
          </FormField>
          <Button type="submit" disabled={householdId === null || semesterName.trim().length === 0}>Create Semester</Button>
        </form>
      </Card>

      <Card className="dashboard-panel">
        <h2>Create Subject</h2>
        <form className="children-form" onSubmit={onCreateSubject}>
          <FormField label="Subject Name">
            <TextInput value={subjectName} onChange={(event) => onSubjectNameChange(event.target.value)} placeholder="Math" required maxLength={255} />
          </FormField>
          <FormField label="Color">
            <TextInput value={subjectColor} onChange={(event) => onSubjectColorChange(event.target.value)} placeholder="#3b82f6" required maxLength={32} />
          </FormField>
          <Button type="submit" disabled={householdId === null || subjectName.trim().length === 0}>Create Subject</Button>
        </form>
      </Card>

      <Card className="dashboard-panel">
        <h2>Quick Attendance</h2>
        <form className="children-form" onSubmit={onSaveAttendance}>
          <ChildSelect value={attendance.childId} children={children} onChange={(childId) => onAttendanceChange({ childId })} />
          <SubjectSelect value={attendance.subjectId} subjects={subjects} onChange={(subjectId) => onAttendanceChange({ subjectId })} />
          <FormField label="Date">
            <DateInput value={attendance.date} onChange={(event) => onAttendanceChange({ date: event.target.value })} required />
          </FormField>
          <label className="checkbox-row">
            <input type="checkbox" checked={attendance.present} onChange={(event) => onAttendanceChange({ present: event.target.checked })} />
            Present
          </label>
          <FormField label="Comment">
            <TextInput value={attendance.comment} onChange={(event) => onAttendanceChange({ comment: event.target.value })} placeholder="Fractions, copywork, field trip..." maxLength={2000} />
          </FormField>
          <Button type="submit" disabled={attendance.childId === "" || attendance.subjectId === ""}>Save Attendance</Button>
        </form>
      </Card>

      <Card className="dashboard-panel">
        <h2>Day Comment</h2>
        <form className="children-form" onSubmit={onSaveDayComment}>
          <ChildSelect value={dayComment.childId} children={children} onChange={(childId) => onDayCommentChange({ childId })} />
          <FormField label="Date">
            <DateInput value={dayComment.date} onChange={(event) => onDayCommentChange({ date: event.target.value })} required />
          </FormField>
          <FormField label="Comment">
            <TextInput value={dayComment.comment} onChange={(event) => onDayCommentChange({ comment: event.target.value })} placeholder="Field trip, sick day, reading notes..." maxLength={4000} />
          </FormField>
          <Button type="submit" disabled={dayComment.childId === ""}>Save Comment</Button>
        </form>
      </Card>

      <Card className="dashboard-panel">
        <h2>Subject Grade</h2>
        <form className="children-form" onSubmit={onSaveGrade}>
          <ChildSelect value={grade.childId} children={children} onChange={(childId) => onGradeChange({ childId })} />
          <SubjectSelect value={grade.subjectId} subjects={subjects} onChange={(subjectId) => onGradeChange({ subjectId })} />
          <FormField label="Semester">
            <select className="text-input" value={grade.semesterId} onChange={(event) => onGradeChange({ semesterId: event.target.value })}>
              <option value="">Overall / no semester</option>
              {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
            </select>
          </FormField>
          <FormField label="Grade">
            <TextInput value={grade.grade} onChange={(event) => onGradeChange({ grade: event.target.value })} placeholder="A, 95%, Complete..." maxLength={64} />
          </FormField>
          <Button type="submit" disabled={grade.childId === "" || grade.subjectId === ""}>Save Grade</Button>
        </form>
      </Card>
    </>
  );
}

type ChildSelectProps = {
  value: string;
  children: Child[];
  onChange: (value: string) => void;
};

function ChildSelect({ value, children, onChange }: ChildSelectProps): ReactElement {
  return (
    <FormField label="Child">
      <select className="text-input" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select child</option>
        {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
      </select>
    </FormField>
  );
}

type SubjectSelectProps = {
  value: string;
  subjects: HomeschoolSubject[];
  onChange: (value: string) => void;
};

function SubjectSelect({ value, subjects, onChange }: SubjectSelectProps): ReactElement {
  return (
    <FormField label="Subject">
      <select className="text-input" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select subject</option>
        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
    </FormField>
  );
}
