from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import HomeschoolProgressStatus, HomeschoolSubjectArea


class HomeschoolSemesterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    name: str
    start_date: date
    end_date: date
    active: bool


class CreateHomeschoolSemesterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    start_date: date
    end_date: date
    active: bool = True

    @model_validator(mode="after")
    def validate_dates(self) -> "CreateHomeschoolSemesterRequest":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        return self


class UpdateHomeschoolSemesterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    start_date: date
    end_date: date
    active: bool = True

    @model_validator(mode="after")
    def validate_dates(self) -> "UpdateHomeschoolSemesterRequest":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        return self


class HomeschoolSubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    name: str
    color: str
    active: bool


class CreateHomeschoolSubjectRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(default="#3b82f6", min_length=1, max_length=32)
    active: bool = True


class UpdateHomeschoolSubjectRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(default="#3b82f6", min_length=1, max_length=32)
    active: bool = True


class HomeschoolAttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    child_id: int
    subject_id: int
    date: date
    present: bool
    comment: str


class UpsertHomeschoolAttendanceRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    child_id: int = Field(gt=0)
    subject_id: int = Field(gt=0)
    date: date
    present: bool = True
    comment: str = Field(default="", max_length=2000)


class HomeschoolDayCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    child_id: int
    date: date
    comment: str


class UpsertHomeschoolDayCommentRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    child_id: int = Field(gt=0)
    date: date
    comment: str = Field(default="", max_length=4000)


class HomeschoolGradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    child_id: int
    subject_id: int
    semester_id: int | None
    grade: str


class UpsertHomeschoolGradeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    child_id: int = Field(gt=0)
    subject_id: int = Field(gt=0)
    semester_id: int | None = Field(default=None, gt=0)
    grade: str = Field(default="", max_length=64)


class HomeschoolCourseStudentSummary(BaseModel):
    child_id: int
    child_name: str
    lesson_count: int
    completed_count: int
    in_progress_count: int
    needs_review_count: int
    completion_percent: int


class HomeschoolCourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    subject_area: HomeschoolSubjectArea
    grade_level: int
    title: str
    description: str
    color: str
    icon: str
    active: bool
    archived_at: datetime | None
    assigned_child_ids: list[int] = Field(default_factory=list)
    lesson_count: int = 0
    completed_count: int = 0
    in_progress_count: int = 0
    needs_review_count: int = 0
    completion_percent: int = 0
    student_summaries: list[HomeschoolCourseStudentSummary] = Field(default_factory=list)


class CreateHomeschoolCourseRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    subject_area: HomeschoolSubjectArea
    grade_level: int = Field(ge=1, le=5)
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=3000)
    color: str = Field(default="#3b82f6", min_length=1, max_length=32)
    icon: str = Field(default="book-open", min_length=1, max_length=64)
    active: bool = True
    assigned_child_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_assigned_child_ids(self) -> "CreateHomeschoolCourseRequest":
        if len(set(self.assigned_child_ids)) != len(self.assigned_child_ids):
            raise ValueError("assigned_child_ids must not contain duplicates.")
        return self


class UpdateHomeschoolCourseRequest(CreateHomeschoolCourseRequest):
    pass


class HomeschoolLessonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    course_id: int
    title: str
    overview: str
    sequence_order: int
    estimated_minutes: int | None
    activity_prompt: str
    answer_key: str
    learning_objectives: str
    materials: str
    warm_up: str
    direct_instruction: str
    guided_practice: str
    independent_practice: str
    assessment: str
    extension: str
    remediation: str
    archived_at: datetime | None


class CreateHomeschoolLessonRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    overview: str = Field(default="", max_length=5000)
    sequence_order: int = Field(gt=0)
    estimated_minutes: int | None = Field(default=None, gt=0)
    activity_prompt: str = Field(default="", max_length=5000)
    answer_key: str = Field(default="", max_length=5000)
    learning_objectives: str = Field(default="", max_length=12000)
    materials: str = Field(default="", max_length=12000)
    warm_up: str = Field(default="", max_length=12000)
    direct_instruction: str = Field(default="", max_length=12000)
    guided_practice: str = Field(default="", max_length=12000)
    independent_practice: str = Field(default="", max_length=12000)
    assessment: str = Field(default="", max_length=12000)
    extension: str = Field(default="", max_length=12000)
    remediation: str = Field(default="", max_length=12000)


class UpdateHomeschoolLessonRequest(CreateHomeschoolLessonRequest):
    pass


class HomeschoolProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    child_id: int
    course_id: int
    lesson_id: int
    status: HomeschoolProgressStatus
    score_percent: int | None
    completed_at: datetime | None
    notes: str


class UpsertHomeschoolProgressRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    child_id: int = Field(gt=0)
    lesson_id: int = Field(gt=0)
    status: HomeschoolProgressStatus
    score_percent: int | None = Field(default=None, ge=0, le=100)
    completed_at: datetime | None = None
    notes: str = Field(default="", max_length=3000)


class HomeschoolStudentLearningSummary(BaseModel):
    child_id: int
    child_name: str
    active: bool
    assigned_course_count: int
    lesson_count: int
    completed_count: int
    needs_review_count: int
    completion_percent: int


class HomeschoolLearningSummaryResponse(BaseModel):
    students: list[HomeschoolStudentLearningSummary]
    courses: list[HomeschoolCourseResponse]
    progress_records: list[HomeschoolProgressResponse]


class BuiltInMathLessonResponse(BaseModel):
    sequence_order: int
    title: str
    overview: str
    estimated_minutes: int
    activity_prompt: str
    answer_key: str
    learning_objectives: str
    materials: str
    warm_up: str
    direct_instruction: str
    guided_practice: str
    independent_practice: str
    assessment: str
    extension: str
    remediation: str


class BuiltInMathCourseResponse(BaseModel):
    grade_level: int
    title: str
    description: str
    color: str
    icon: str
    topics: list[str]
    lessons: list[BuiltInMathLessonResponse]


class ImportBuiltInMathCourseRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    household_id: int = Field(gt=0)
    grade_level: int = Field(ge=1, le=5)
    assigned_child_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_assigned_child_ids(self) -> "ImportBuiltInMathCourseRequest":
        if len(set(self.assigned_child_ids)) != len(self.assigned_child_ids):
            raise ValueError("assigned_child_ids must not contain duplicates.")
        return self
