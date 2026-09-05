import { View } from "react-native";

import type {
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import type { SemesterFormState, SubjectFormState } from "../lib/defaults";
import {
  HomeschoolSemesterFormSection,
  HomeschoolSemesterListSection,
} from "./HomeschoolSemesterSection";
import {
  HomeschoolSubjectFormSection,
  HomeschoolSubjectListSection,
} from "./HomeschoolSubjectSection";

export { HomeschoolAttendanceSection } from "./HomeschoolAttendanceSection";
export {
  HomeschoolCommentSection,
  HomeschoolCommentSection as HomeschoolCommentsSection,
} from "./HomeschoolCommentSection";
export {
  HomeschoolGradeSection,
  HomeschoolGradeSection as HomeschoolGradesSection,
} from "./HomeschoolGradeSection";
export { HomeschoolOverview } from "./HomeschoolOverview";
export { HomeschoolSemesterSection } from "./HomeschoolSemesterSection";
export { HomeschoolSubjectSection } from "./HomeschoolSubjectSection";
export type {
  AttendanceFormState,
  DayCommentFormState,
  GradeFormState,
  SemesterFormState,
  SubjectFormState,
} from "../lib/defaults";

export function HomeschoolSetupSection({
  busy,
  editingSemesterId,
  editingSubjectId,
  semesterForm,
  semesters,
  subjectForm,
  subjects,
  onCancelSemesterEdit,
  onCancelSubjectEdit,
  onDeleteSemester,
  onDeleteSubject,
  onEditSemester,
  onEditSubject,
  onSaveSemester,
  onSaveSubject,
  onSemesterChange,
  onSubjectChange,
}: {
  busy: boolean;
  editingSemesterId: number | null;
  editingSubjectId: number | null;
  semesterForm: SemesterFormState;
  semesters: HomeschoolSemester[];
  subjectForm: SubjectFormState;
  subjects: HomeschoolSubject[];
  onCancelSemesterEdit: () => void;
  onCancelSubjectEdit: () => void;
  onDeleteSemester: (semester: HomeschoolSemester) => void;
  onDeleteSubject: (subject: HomeschoolSubject) => void;
  onEditSemester: (semester: HomeschoolSemester) => void;
  onEditSubject: (subject: HomeschoolSubject) => void;
  onSaveSemester: () => void;
  onSaveSubject: () => void;
  onSemesterChange: (patch: Partial<SemesterFormState>) => void;
  onSubjectChange: (patch: Partial<SubjectFormState>) => void;
}) {
  return (
    <View>
      <HomeschoolSemesterFormSection
        busy={busy}
        editingSemesterId={editingSemesterId}
        form={semesterForm}
        onCancelEdit={onCancelSemesterEdit}
        onChange={onSemesterChange}
        onSave={onSaveSemester}
      />
      <HomeschoolSubjectFormSection
        busy={busy}
        editingSubjectId={editingSubjectId}
        form={subjectForm}
        onCancelEdit={onCancelSubjectEdit}
        onChange={onSubjectChange}
        onSave={onSaveSubject}
      />
      <HomeschoolSemesterListSection
        busy={busy}
        semesters={semesters}
        onDelete={onDeleteSemester}
        onEdit={onEditSemester}
      />
      <HomeschoolSubjectListSection
        busy={busy}
        subjects={subjects}
        onDelete={onDeleteSubject}
        onEdit={onEditSubject}
      />
    </View>
  );
}
