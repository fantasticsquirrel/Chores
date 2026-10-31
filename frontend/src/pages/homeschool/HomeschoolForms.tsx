import type { FormEvent, ReactElement } from "react";

import type { Child, HomeschoolSemester, HomeschoolSubject } from "../../api";
import { Button, Card, DateInput, FormField, TextInput } from "../../ui";
import { normalizeHexColor, subjectColors } from "../../features/homeschool/lib/attendance";

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
  editingSemesterId: number | null;
  editingSubjectId: number | null;
  dayComment: DayCommentFormState;
  grade: GradeFormState;
  onSemesterNameChange: (value: string) => void;
  onSemesterStartChange: (value: string) => void;
  onSemesterEndChange: (value: string) => void;
  onSubjectNameChange: (value: string) => void;
  onSubjectColorChange: (value: string) => void;
  onDayCommentChange: (patch: Partial<DayCommentFormState>) => void;
  onGradeChange: (patch: Partial<GradeFormState>) => void;
  onCancelSemesterEdit: () => void;
  onCancelSubjectEdit: () => void;
  onCreateSemester: (event: FormEvent<HTMLFormElement>) => void;
  onCreateSubject: (event: FormEvent<HTMLFormElement>) => void;
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
  editingSemesterId,
  editingSubjectId,
  dayComment,
  grade,
  onSemesterNameChange,
  onSemesterStartChange,
  onSemesterEndChange,
  onSubjectNameChange,
  onSubjectColorChange,
  onDayCommentChange,
  onGradeChange,
  onCancelSemesterEdit,
  onCancelSubjectEdit,
  onCreateSemester,
  onCreateSubject,
  onSaveDayComment,
  onSaveGrade,
}: HomeschoolFormsProps): ReactElement {
  const usedSubjectColors = new Set(subjects.filter((subject) => subject.id !== editingSubjectId).map((subject) => normalizeHexColor(subject.color) ?? subject.color.trim().toLowerCase()));
  const selectedSubjectColor = normalizeHexColor(subjectColor);
  return (
    <>
      <Card className="dashboard-panel homeschool-form-card">
        <h2>{editingSemesterId === null ? "Create Semester" : "Edit Semester"}</h2>
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
          <div className="item-actions">
            <Button type="submit" disabled={householdId === null || semesterName.trim().length === 0}>{editingSemesterId === null ? "Create Semester" : "Update Semester"}</Button>
            {editingSemesterId !== null ? <Button type="button" onClick={onCancelSemesterEdit}>Cancel</Button> : null}
          </div>
        </form>
      </Card>

      <Card className="dashboard-panel homeschool-form-card">
        <h2>{editingSubjectId === null ? "Create Subject" : "Edit Subject"}</h2>
        <form className="children-form" onSubmit={onCreateSubject}>
          <FormField label="Subject Name">
            <TextInput value={subjectName} onChange={(event) => onSubjectNameChange(event.target.value)} placeholder="Math" required maxLength={255} />
          </FormField>
          <FormField label="Color">
            <input className="homeschool-color-input" type="color" value={/^#[0-9a-f]{6}$/i.test(subjectColor) ? subjectColor : "#1d4ed8"} onChange={(event) => onSubjectColorChange(event.target.value)} />
          </FormField>
          <div className="homeschool-color-swatches" role="group" aria-label="Subject colors">
            {subjectColors.map((color) => {
              const used = usedSubjectColors.has(color.value);
              const selected = selectedSubjectColor === color.value;
              return <button type="button" key={color.value} aria-label={`${color.name}${used ? " (used)" : ""}`} aria-pressed={selected} disabled={used} title={used ? `${color.name} is already used by another subject` : color.name} style={{ background: color.value }} onClick={() => onSubjectColorChange(color.value)}>{selected ? "✓" : ""}</button>;
            })}
          </div>
          <div className="homeschool-subject-preview" aria-label="Subject color preview"><span className="subject-attendance-color" style={{ background: subjectColor }} />{subjectName.trim() || "New subject"}</div>
          <div className="item-actions">
            <Button type="submit" disabled={householdId === null || subjectName.trim().length === 0}>{editingSubjectId === null ? "Create Subject" : "Update Subject"}</Button>
            {editingSubjectId !== null ? <Button type="button" onClick={onCancelSubjectEdit}>Cancel</Button> : null}
          </div>
        </form>
      </Card>

      <Card className="dashboard-panel homeschool-record-card">
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

      <Card className="dashboard-panel homeschool-record-card">
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
