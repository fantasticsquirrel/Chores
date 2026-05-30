import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";

import {
  apiClient,
  ApiClientError,
  type BuiltInMathCourse,
  type Child,
  type HomeschoolCourse,
  type HomeschoolLearningSummary,
  type HomeschoolLesson,
  type HomeschoolProgressStatus,
  type HomeschoolSubjectArea,
} from "../../api";
import { Badge, Button, Card, CheckboxField, FormField, InlineNotice, TextInput } from "../../ui";

type HomeschoolLearningPlatformProps = {
  householdId: number | null;
  children: Child[];
};

type SubjectFilter = HomeschoolSubjectArea | "all";

type CourseFormState = {
  subjectArea: HomeschoolSubjectArea;
  gradeLevel: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  assignedChildIds: number[];
};

type LessonFormState = {
  title: string;
  overview: string;
  sequenceOrder: string;
  estimatedMinutes: string;
  activityPrompt: string;
  answerKey: string;
  learningObjectives: string;
  materials: string;
  warmUp: string;
  directInstruction: string;
  guidedPractice: string;
  independentPractice: string;
  assessment: string;
  extension: string;
  remediation: string;
};

type ProgressFormState = {
  childId: string;
  lessonId: string;
  status: HomeschoolProgressStatus;
  scorePercent: string;
  notes: string;
};

const subjectOptions: { value: HomeschoolSubjectArea; label: string }[] = [
  { value: "math", label: "Math" },
  { value: "science", label: "Science" },
  { value: "grammar", label: "Grammar" },
  { value: "vocabulary", label: "Vocabulary" },
];

const progressOptions: { value: HomeschoolProgressStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "needs_review", label: "Needs Review" },
];

const emptySummary: HomeschoolLearningSummary = {
  students: [],
  courses: [],
  progress_records: [],
};

function buildEmptyCourseForm(children: Child[]): CourseFormState {
  return {
    subjectArea: "math",
    gradeLevel: "1",
    title: "",
    description: "",
    color: "#20d3ff",
    icon: "abacus",
    assignedChildIds: children.filter((child) => child.active).map((child) => child.id),
  };
}

const emptyLessonForm: LessonFormState = {
  title: "",
  overview: "",
  sequenceOrder: "1",
  estimatedMinutes: "25",
  activityPrompt: "",
  answerKey: "",
  learningObjectives: "",
  materials: "",
  warmUp: "",
  directInstruction: "",
  guidedPractice: "",
  independentPractice: "",
  assessment: "",
  extension: "",
  remediation: "",
};

const emptyProgressForm: ProgressFormState = {
  childId: "",
  lessonId: "",
  status: "not_started",
  scorePercent: "",
  notes: "",
};

export function HomeschoolLearningPlatform({ householdId, children }: HomeschoolLearningPlatformProps): ReactElement {
  const [summary, setSummary] = useState<HomeschoolLearningSummary>(emptySummary);
  const [mathCurriculum, setMathCurriculum] = useState<BuiltInMathCourse[]>([]);
  const [lessons, setLessons] = useState<HomeschoolLesson[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [courseForm, setCourseForm] = useState<CourseFormState>(() => buildEmptyCourseForm(children));
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);
  const [progressForm, setProgressForm] = useState<ProgressFormState>(emptyProgressForm);
  const [importAssignedChildIds, setImportAssignedChildIds] = useState<number[]>([]);

  const activeChildren = useMemo(() => children.filter((child) => child.active), [children]);
  const courses = summary.courses;
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const filteredCourses = subjectFilter === "all" ? courses : courses.filter((course) => course.subject_area === subjectFilter);
  const totalCompleted = summary.students.reduce((total, student) => total + student.completed_count, 0);
  const totalLessons = summary.students.reduce((total, student) => total + student.lesson_count, 0);
  const overallPercent = percent(totalCompleted, totalLessons);

  const refreshLearning = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setLoading(false);
      setError("Could not determine household scope.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [learningSummary, builtInMath] = await Promise.all([
        apiClient.getHomeschoolLearningSummary(householdId),
        apiClient.listBuiltInMathCurriculum(),
      ]);
      setSummary(learningSummary);
      setMathCurriculum(builtInMath);
      setSelectedCourseId((previousCourseId) => {
        if (previousCourseId !== null && learningSummary.courses.some((course) => course.id === previousCourseId)) {
          return previousCourseId;
        }
        return learningSummary.courses[0]?.id ?? null;
      });
    } catch (loadError: unknown) {
      setSummary(emptySummary);
      setMathCurriculum([]);
      setError(formatLearningError(loadError));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void refreshLearning();
  }, [refreshLearning]);

  useEffect(() => {
    if (activeChildren.length === 0) {
      setImportAssignedChildIds([]);
      setCourseForm((previous) => ({ ...previous, assignedChildIds: [] }));
      return;
    }

    setImportAssignedChildIds((previous) => (previous.length > 0 ? previous : activeChildren.map((child) => child.id)));
    setCourseForm((previous) => (
      previous.assignedChildIds.length > 0 ? previous : { ...previous, assignedChildIds: activeChildren.map((child) => child.id) }
    ));
  }, [activeChildren]);

  useEffect(() => {
    if (householdId === null || selectedCourseId === null) {
      setLessons([]);
      return;
    }

    setLessonsLoading(true);
    apiClient.listHomeschoolLessons(selectedCourseId, householdId)
      .then((courseLessons) => {
        setLessons(courseLessons);
        setLessonForm((previous) => (
          editingLessonId === null && previous.title.length === 0
            ? { ...previous, sequenceOrder: String(courseLessons.length + 1) }
            : previous
        ));
      })
      .catch((loadError: unknown) => {
        setLessons([]);
        setError(formatLearningError(loadError));
      })
      .finally(() => {
        setLessonsLoading(false);
      });
  }, [editingLessonId, householdId, selectedCourseId]);

  useEffect(() => {
    const availableChildIds = selectedCourse?.assigned_child_ids.length
      ? selectedCourse.assigned_child_ids
      : activeChildren.map((child) => child.id);
    const defaultChildId = availableChildIds[0];
    const availableLessonIds = lessons.map((lesson) => lesson.id);
    const defaultLessonId = availableLessonIds[0];
    setProgressForm((previous) => ({
      ...previous,
      childId: previous.childId !== "" && availableChildIds.includes(Number(previous.childId))
        ? previous.childId
        : defaultChildId === undefined ? "" : String(defaultChildId),
      lessonId: previous.lessonId !== "" && availableLessonIds.includes(Number(previous.lessonId))
        ? previous.lessonId
        : defaultLessonId === undefined ? "" : String(defaultLessonId),
    }));
  }, [activeChildren, lessons, selectedCourse]);

  useEffect(() => {
    if (progressForm.childId === "" || progressForm.lessonId === "") {
      return;
    }

    const existingProgress = summary.progress_records.find(
      (record) => record.child_id === Number(progressForm.childId) && record.lesson_id === Number(progressForm.lessonId),
    );
    setProgressForm((previous) => ({
      ...previous,
      status: existingProgress?.status ?? "not_started",
      scorePercent: existingProgress?.score_percent?.toString() ?? "",
      notes: existingProgress?.notes ?? "",
    }));
  }, [progressForm.childId, progressForm.lessonId, summary.progress_records]);

  function clearCourseForm(): void {
    setEditingCourseId(null);
    setCourseForm(buildEmptyCourseForm(children));
  }

  function clearLessonForm(): void {
    setEditingLessonId(null);
    setLessonForm({ ...emptyLessonForm, sequenceOrder: String(lessons.length + 1) });
  }

  function startCourseEdit(course: HomeschoolCourse): void {
    setEditingCourseId(course.id);
    setCourseForm({
      subjectArea: course.subject_area,
      gradeLevel: String(course.grade_level),
      title: course.title,
      description: course.description,
      color: course.color,
      icon: course.icon,
      assignedChildIds: course.assigned_child_ids,
    });
  }

  function startLessonEdit(lesson: HomeschoolLesson): void {
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      overview: lesson.overview,
      sequenceOrder: String(lesson.sequence_order),
      estimatedMinutes: lesson.estimated_minutes?.toString() ?? "",
      activityPrompt: lesson.activity_prompt,
      answerKey: lesson.answer_key,
      learningObjectives: lesson.learning_objectives,
      materials: lesson.materials,
      warmUp: lesson.warm_up,
      directInstruction: lesson.direct_instruction,
      guidedPractice: lesson.guided_practice,
      independentPractice: lesson.independent_practice,
      assessment: lesson.assessment,
      extension: lesson.extension,
      remediation: lesson.remediation,
    });
  }

  async function handleSaveCourse(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;
    setError(null);
    setMessage(null);
    const payload = {
      household_id: householdId,
      subject_area: courseForm.subjectArea,
      grade_level: Number(courseForm.gradeLevel),
      title: courseForm.title,
      description: courseForm.description,
      color: courseForm.color,
      icon: courseForm.icon,
      active: true,
      assigned_child_ids: courseForm.assignedChildIds,
    };
    try {
      const savedCourse = editingCourseId === null
        ? await apiClient.createHomeschoolCourse(payload)
        : await apiClient.updateHomeschoolCourse(editingCourseId, payload);
      setSelectedCourseId(savedCourse.id);
      setMessage(`${editingCourseId === null ? "Created" : "Updated"} course ${savedCourse.title}.`);
      clearCourseForm();
      await refreshLearning();
    } catch (saveError: unknown) {
      setError(formatLearningError(saveError));
    }
  }

  async function handleArchiveCourse(course: HomeschoolCourse): Promise<void> {
    if (householdId === null || !window.confirm(`Archive ${course.title}?`)) return;
    setError(null);
    setMessage(null);
    try {
      await apiClient.archiveHomeschoolCourse(course.id, householdId);
      setMessage(`Archived course ${course.title}.`);
      if (selectedCourseId === course.id) {
        setSelectedCourseId(null);
      }
      await refreshLearning();
    } catch (archiveError: unknown) {
      setError(formatLearningError(archiveError));
    }
  }

  async function handleSaveLesson(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null || selectedCourseId === null) return;
    setError(null);
    setMessage(null);
    const payload = {
      household_id: householdId,
      title: lessonForm.title,
      overview: lessonForm.overview,
      sequence_order: Number(lessonForm.sequenceOrder),
      estimated_minutes: lessonForm.estimatedMinutes === "" ? null : Number(lessonForm.estimatedMinutes),
      activity_prompt: lessonForm.activityPrompt,
      answer_key: lessonForm.answerKey,
      learning_objectives: lessonForm.learningObjectives,
      materials: lessonForm.materials,
      warm_up: lessonForm.warmUp,
      direct_instruction: lessonForm.directInstruction,
      guided_practice: lessonForm.guidedPractice,
      independent_practice: lessonForm.independentPractice,
      assessment: lessonForm.assessment,
      extension: lessonForm.extension,
      remediation: lessonForm.remediation,
    };
    try {
      const savedLesson = editingLessonId === null
        ? await apiClient.createHomeschoolLesson(selectedCourseId, payload)
        : await apiClient.updateHomeschoolLesson(editingLessonId, payload);
      setMessage(`${editingLessonId === null ? "Created" : "Updated"} lesson ${savedLesson.title}.`);
      clearLessonForm();
      await refreshLearning();
      if (householdId !== null) {
        setLessons(await apiClient.listHomeschoolLessons(selectedCourseId, householdId));
      }
    } catch (saveError: unknown) {
      setError(formatLearningError(saveError));
    }
  }

  async function handleArchiveLesson(lesson: HomeschoolLesson): Promise<void> {
    if (householdId === null || selectedCourseId === null || !window.confirm(`Archive ${lesson.title}?`)) return;
    setError(null);
    setMessage(null);
    try {
      await apiClient.archiveHomeschoolLesson(lesson.id, householdId);
      setMessage(`Archived lesson ${lesson.title}.`);
      setLessons(await apiClient.listHomeschoolLessons(selectedCourseId, householdId));
      await refreshLearning();
    } catch (archiveError: unknown) {
      setError(formatLearningError(archiveError));
    }
  }

  async function handleSaveProgress(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null || progressForm.childId === "" || progressForm.lessonId === "") return;
    setError(null);
    setMessage(null);
    try {
      await apiClient.upsertHomeschoolProgress({
        household_id: householdId,
        child_id: Number(progressForm.childId),
        lesson_id: Number(progressForm.lessonId),
        status: progressForm.status,
        score_percent: progressForm.scorePercent === "" ? null : Number(progressForm.scorePercent),
        notes: progressForm.notes,
      });
      setMessage("Saved lesson progress.");
      await refreshLearning();
    } catch (saveError: unknown) {
      setError(formatLearningError(saveError));
    }
  }

  async function handleImportMathCourse(gradeLevel: number): Promise<void> {
    if (householdId === null) return;
    setError(null);
    setMessage(null);
    try {
      const importedCourse = await apiClient.importBuiltInMathCourse({
        household_id: householdId,
        grade_level: gradeLevel,
        assigned_child_ids: importAssignedChildIds,
      });
      setSelectedCourseId(importedCourse.id);
      setMessage(`Imported ${importedCourse.title}.`);
      await refreshLearning();
    } catch (importError: unknown) {
      setError(formatLearningError(importError));
    }
  }

  return (
    <>
      <div className="dashboard-section-header">
        <p className="eyebrow">Learning Platform</p>
        <h2>Courses, Lessons, and Progress</h2>
        <p>Plan grade-level work, assign it to household students, and track lesson completion from one teacher view.</p>
      </div>

      {error !== null ? <InlineNotice variant="error">Learning action failed: {error}</InlineNotice> : null}
      {message !== null ? <InlineNotice>{message}</InlineNotice> : null}

      <Card className="learning-hero dashboard-panel">
        <div>
          <p className="eyebrow">Teacher Dashboard</p>
          <h2>Homeschool Learning</h2>
          <p>Math, science, grammar, and vocabulary courses are household-scoped and assigned to existing Family Manager children.</p>
        </div>
        <div className="learning-metrics" aria-label="Learning progress metrics">
          <Metric label="Students" value={loading ? "-" : String(summary.students.length)} />
          <Metric label="Courses" value={loading ? "-" : String(courses.length)} />
          <Metric label="Completion" value={loading ? "-" : `${overallPercent}%`} />
        </div>
      </Card>

      <Card className="learning-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Courses</p>
            <h2>Learning Dashboard</h2>
          </div>
          <div className="subject-filter-row" aria-label="Subject filters">
            <Button type="button" className={subjectFilter === "all" ? "compact-button active-filter" : "compact-button"} onClick={() => setSubjectFilter("all")}>
              All
            </Button>
            {subjectOptions.map((subject) => (
              <Button
                key={subject.value}
                type="button"
                className={subjectFilter === subject.value ? "compact-button active-filter" : "compact-button"}
                onClick={() => setSubjectFilter(subject.value)}
              >
                {subject.label}
              </Button>
            ))}
          </div>
        </div>
        {filteredCourses.length === 0 ? (
          <p>No courses yet for this filter.</p>
        ) : (
          <div className="learning-course-grid">
            {filteredCourses.map((course) => (
              <article
                key={course.id}
                className={course.id === selectedCourseId ? "learning-course-card selected" : "learning-course-card"}
                style={{ borderColor: course.color }}
              >
                <div className="panel-header-row">
                  <div>
                    <Badge>{formatSubject(course.subject_area)} Grade {course.grade_level}</Badge>
                    <h3>{course.title}</h3>
                  </div>
                  <span className="course-icon" aria-hidden="true">{course.icon.slice(0, 2).toUpperCase()}</span>
                </div>
                <p>{course.description || "No description yet."}</p>
                <ProgressBar percent={course.completion_percent} label={`${course.completion_percent}% complete`} />
                <p className="balance-meta">
                  {course.completed_count} of {course.lesson_count * course.assigned_child_ids.length} assigned lesson records complete
                </p>
                <ul className="student-chip-list" aria-label={`${course.title} assigned students`}>
                  {course.student_summaries.length === 0 ? (
                    <li>No students assigned</li>
                  ) : course.student_summaries.map((student) => (
                    <li key={student.child_id}>
                      {student.child_name}: {student.completion_percent}%
                    </li>
                  ))}
                </ul>
                <div className="quick-actions">
                  <Button type="button" className="compact-button" onClick={() => setSelectedCourseId(course.id)}>Open</Button>
                  <Button type="button" className="compact-button" onClick={() => startCourseEdit(course)}>Edit Course</Button>
                  <Button type="button" className="compact-button" variant="danger" onClick={() => void handleArchiveCourse(course)}>Archive Course</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card className="learning-panel">
        <p className="eyebrow">Students</p>
        <h2>Student Progress</h2>
        <div className="learning-student-grid">
          {summary.students.map((student) => (
            <article key={student.child_id} className="student-progress-card">
              <div className="panel-header-row">
                <h3>{student.child_name}</h3>
                <Badge>{student.active ? "Active" : "Inactive"}</Badge>
              </div>
              <ProgressBar percent={student.completion_percent} label={`${student.completion_percent}% complete`} />
              <p className="balance-meta">
                {student.completed_count}/{student.lesson_count} lessons complete across {student.assigned_course_count} courses.
              </p>
              {student.needs_review_count > 0 ? <Badge>{student.needs_review_count} need review</Badge> : null}
            </article>
          ))}
        </div>
      </Card>

      <Card className="learning-form-card">
        <p className="eyebrow">Course Builder</p>
        <h2>{editingCourseId === null ? "Create Course" : "Edit Course"}</h2>
        <form className="children-form learning-form" onSubmit={(event) => void handleSaveCourse(event)}>
          <FormField label="Course Title">
            <TextInput value={courseForm.title} required onChange={(event) => setCourseForm((previous) => ({ ...previous, title: event.target.value }))} />
          </FormField>
          <FormField label="Subject Area">
            <select value={courseForm.subjectArea} onChange={(event) => setCourseForm((previous) => ({ ...previous, subjectArea: event.target.value as HomeschoolSubjectArea }))}>
              {subjectOptions.map((subject) => <option key={subject.value} value={subject.value}>{subject.label}</option>)}
            </select>
          </FormField>
          <FormField label="Grade Level">
            <TextInput type="number" min="1" max="5" value={courseForm.gradeLevel} required onChange={(event) => setCourseForm((previous) => ({ ...previous, gradeLevel: event.target.value }))} />
          </FormField>
          <FormField label="Color">
            <TextInput value={courseForm.color} required onChange={(event) => setCourseForm((previous) => ({ ...previous, color: event.target.value }))} />
          </FormField>
          <FormField label="Icon">
            <TextInput value={courseForm.icon} required onChange={(event) => setCourseForm((previous) => ({ ...previous, icon: event.target.value }))} />
          </FormField>
          <FormField label="Description" className="full-width-field">
            <textarea value={courseForm.description} onChange={(event) => setCourseForm((previous) => ({ ...previous, description: event.target.value }))} />
          </FormField>
          <fieldset className="plain-fieldset full-width-field">
            <legend>Assigned Students</legend>
            <div className="checkbox-grid">
              {children.map((child) => (
                <CheckboxField
                  key={child.id}
                  label={child.name}
                  checked={courseForm.assignedChildIds.includes(child.id)}
                  onChange={() => setCourseForm((previous) => ({
                    ...previous,
                    assignedChildIds: toggleNumber(previous.assignedChildIds, child.id),
                  }))}
                />
              ))}
            </div>
          </fieldset>
          <div className="quick-actions full-width-field">
            <Button type="submit">{editingCourseId === null ? "Create Course" : "Update Course"}</Button>
            {editingCourseId !== null ? <Button type="button" onClick={clearCourseForm}>Cancel Course Edit</Button> : null}
          </div>
        </form>
      </Card>

      <Card className="learning-form-card">
        <p className="eyebrow">Lesson Studio</p>
        <h2>Lesson Builder</h2>
        {selectedCourse === null ? (
          <p>Select or create a course before adding lessons.</p>
        ) : (
          <>
            <p className="balance-meta">Selected course: {selectedCourse.title}</p>
            <form className="children-form learning-form" onSubmit={(event) => void handleSaveLesson(event)}>
              <FormField label="Lesson Title">
                <TextInput value={lessonForm.title} required onChange={(event) => setLessonForm((previous) => ({ ...previous, title: event.target.value }))} />
              </FormField>
              <FormField label="Sequence Order">
                <TextInput type="number" min="1" value={lessonForm.sequenceOrder} required onChange={(event) => setLessonForm((previous) => ({ ...previous, sequenceOrder: event.target.value }))} />
              </FormField>
              <FormField label="Estimated Minutes">
                <TextInput type="number" min="1" value={lessonForm.estimatedMinutes} onChange={(event) => setLessonForm((previous) => ({ ...previous, estimatedMinutes: event.target.value }))} />
              </FormField>
              <FormField label="Overview" className="full-width-field">
                <textarea value={lessonForm.overview} onChange={(event) => setLessonForm((previous) => ({ ...previous, overview: event.target.value }))} />
              </FormField>
              <FormField label="Activity Prompt" className="full-width-field">
                <textarea value={lessonForm.activityPrompt} onChange={(event) => setLessonForm((previous) => ({ ...previous, activityPrompt: event.target.value }))} />
              </FormField>
              <FormField label="Answer Key / Teacher Notes" className="full-width-field">
                <textarea value={lessonForm.answerKey} onChange={(event) => setLessonForm((previous) => ({ ...previous, answerKey: event.target.value }))} />
              </FormField>
              <FormField label="Learning Objectives" className="full-width-field">
                <textarea value={lessonForm.learningObjectives} onChange={(event) => setLessonForm((previous) => ({ ...previous, learningObjectives: event.target.value }))} />
              </FormField>
              <FormField label="Materials" className="full-width-field">
                <textarea value={lessonForm.materials} onChange={(event) => setLessonForm((previous) => ({ ...previous, materials: event.target.value }))} />
              </FormField>
              <FormField label="Warm-Up" className="full-width-field">
                <textarea value={lessonForm.warmUp} onChange={(event) => setLessonForm((previous) => ({ ...previous, warmUp: event.target.value }))} />
              </FormField>
              <FormField label="Direct Instruction" className="full-width-field">
                <textarea value={lessonForm.directInstruction} onChange={(event) => setLessonForm((previous) => ({ ...previous, directInstruction: event.target.value }))} />
              </FormField>
              <FormField label="Guided Practice" className="full-width-field">
                <textarea value={lessonForm.guidedPractice} onChange={(event) => setLessonForm((previous) => ({ ...previous, guidedPractice: event.target.value }))} />
              </FormField>
              <FormField label="Independent Practice" className="full-width-field">
                <textarea value={lessonForm.independentPractice} onChange={(event) => setLessonForm((previous) => ({ ...previous, independentPractice: event.target.value }))} />
              </FormField>
              <FormField label="Assessment" className="full-width-field">
                <textarea value={lessonForm.assessment} onChange={(event) => setLessonForm((previous) => ({ ...previous, assessment: event.target.value }))} />
              </FormField>
              <FormField label="Extension" className="full-width-field">
                <textarea value={lessonForm.extension} onChange={(event) => setLessonForm((previous) => ({ ...previous, extension: event.target.value }))} />
              </FormField>
              <FormField label="Remediation" className="full-width-field">
                <textarea value={lessonForm.remediation} onChange={(event) => setLessonForm((previous) => ({ ...previous, remediation: event.target.value }))} />
              </FormField>
              <div className="quick-actions full-width-field">
                <Button type="submit">{editingLessonId === null ? "Create Lesson" : "Update Lesson"}</Button>
                {editingLessonId !== null ? <Button type="button" onClick={clearLessonForm}>Cancel Lesson Edit</Button> : null}
              </div>
            </form>
            <LessonList lessons={lessons} loading={lessonsLoading} onEdit={startLessonEdit} onArchive={(lesson) => void handleArchiveLesson(lesson)} />
          </>
        )}
      </Card>

      <Card className="learning-panel">
        <p className="eyebrow">Progress</p>
        <h2>Mark Lesson Progress</h2>
        {selectedCourse === null || lessons.length === 0 ? (
          <p>Select a course with lessons before recording progress.</p>
        ) : (
          <form className="children-form learning-form progress-form" onSubmit={(event) => void handleSaveProgress(event)}>
            <FormField label="Student">
              <select value={progressForm.childId} required onChange={(event) => setProgressForm((previous) => ({ ...previous, childId: event.target.value }))}>
                {(selectedCourse.assigned_child_ids.length > 0 ? children.filter((child) => selectedCourse.assigned_child_ids.includes(child.id)) : children).map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Lesson">
              <select value={progressForm.lessonId} required onChange={(event) => setProgressForm((previous) => ({ ...previous, lessonId: event.target.value }))}>
                {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.sequence_order}. {lesson.title}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={progressForm.status} onChange={(event) => setProgressForm((previous) => ({ ...previous, status: event.target.value as HomeschoolProgressStatus }))}>
                {progressOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <FormField label="Score">
              <TextInput type="number" min="0" max="100" value={progressForm.scorePercent} onChange={(event) => setProgressForm((previous) => ({ ...previous, scorePercent: event.target.value }))} />
            </FormField>
            <FormField label="Notes" className="full-width-field">
              <textarea value={progressForm.notes} onChange={(event) => setProgressForm((previous) => ({ ...previous, notes: event.target.value }))} />
            </FormField>
            <div className="quick-actions full-width-field">
              <Button type="submit">Save Progress</Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="learning-panel math-program-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Built-In Math</p>
            <h2>Grade 1-5 Math Program</h2>
          </div>
          <fieldset className="plain-fieldset import-student-picker">
            <legend>Import For</legend>
            {children.map((child) => (
              <CheckboxField
                key={child.id}
                label={child.name}
                checked={importAssignedChildIds.includes(child.id)}
                onChange={() => setImportAssignedChildIds((previous) => toggleNumber(previous, child.id))}
              />
            ))}
          </fieldset>
        </div>
        <div className="math-grade-grid">
          {mathCurriculum.map((course) => (
            <article key={course.grade_level} className="math-grade-card" style={{ borderColor: course.color }}>
              <div className="panel-header-row">
                <div>
                  <Badge>Grade {course.grade_level}</Badge>
                  <h3>{course.title}</h3>
                </div>
                <Button type="button" className="compact-button" onClick={() => void handleImportMathCourse(course.grade_level)}>
                  Import Grade {course.grade_level} Math
                </Button>
              </div>
              <p>{course.description}</p>
              <div className="topic-chip-row">
                {course.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}
              </div>
              <details>
                <summary>{course.lessons.length} lessons and skills</summary>
                <ol className="curriculum-lesson-list">
                  {course.lessons.map((lesson) => (
                    <li key={lesson.sequence_order}>
                      <strong>{lesson.title}</strong>
                      <span>{lesson.overview}</span>
                      <LessonPlanDetails lesson={lesson} />
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </div>
      </Card>
    </>
  );
}

type LessonPlanContent = {
  learning_objectives: string;
  materials: string;
  warm_up: string;
  direct_instruction: string;
  guided_practice: string;
  independent_practice: string;
  assessment: string;
  extension: string;
  remediation: string;
  activity_prompt: string;
  answer_key: string;
};

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}

function ProgressBar({ percent: rawPercent, label }: { percent: number; label: string }): ReactElement {
  const percent = Math.max(0, Math.min(100, rawPercent));
  return (
    <div className="learning-progress" aria-label={label}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function LessonList({
  lessons,
  loading,
  onEdit,
  onArchive,
}: {
  lessons: HomeschoolLesson[];
  loading: boolean;
  onEdit: (lesson: HomeschoolLesson) => void;
  onArchive: (lesson: HomeschoolLesson) => void;
}): ReactElement {
  if (loading) {
    return <p>Loading lessons...</p>;
  }
  if (lessons.length === 0) {
    return <p>No lessons in this course yet.</p>;
  }

  return (
    <ol className="lesson-management-list" aria-label="Course lesson entries">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <div>
            <strong>{lesson.sequence_order}. {lesson.title}</strong>
            <p>{lesson.estimated_minutes ?? "-"} min · {lesson.overview || "No overview yet."}</p>
            <LessonPlanDetails lesson={lesson} />
          </div>
          <div className="item-actions">
            <Button type="button" className="compact-button" onClick={() => onEdit(lesson)}>Edit Lesson</Button>
            <Button type="button" className="compact-button" variant="danger" onClick={() => onArchive(lesson)}>Archive Lesson</Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LessonPlanDetails({ lesson }: { lesson: LessonPlanContent }): ReactElement {
  const sections = [
    ["Objectives", lesson.learning_objectives],
    ["Materials", lesson.materials],
    ["Warm-Up", lesson.warm_up],
    ["Direct Instruction", lesson.direct_instruction],
    ["Guided Practice", lesson.guided_practice],
    ["Independent Practice", lesson.independent_practice],
    ["Assessment", lesson.assessment],
    ["Extension", lesson.extension],
    ["Remediation", lesson.remediation],
    ["Answer Key", lesson.answer_key],
  ].filter(([, value]) => value.trim().length > 0);

  if (sections.length === 0) {
    return null;
  }

  return (
    <details className="lesson-plan-details">
      <summary>Full lesson plan</summary>
      <div className="lesson-plan-grid">
        {sections.map(([label, value]) => (
          <section key={label} className="lesson-plan-section">
            <h4>{label}</h4>
            <p>{value}</p>
          </section>
        ))}
      </div>
    </details>
  );
}

function toggleNumber(values: number[], value: number): number[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100);
}

function formatSubject(subject: HomeschoolSubjectArea): string {
  return subjectOptions.find((option) => option.value === subject)?.label ?? subject;
}

function formatLearningError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
}
