from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin
from app.models.enums import (
    AssignmentMode,
    CompletionMode,
    CompletionStatus,
    HomeschoolProgressStatus,
    HomeschoolSubjectArea,
    ScheduleMode,
    ScheduleUnit,
    SubmissionStatus,
    TransactionType,
    UserRole,
)


class Household(TimestampMixin, Base):
    __tablename__ = "households"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")


class Child(TimestampMixin, Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("household_id", "email"),
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint(
            "(role = 'CHILD' AND child_id IS NOT NULL) OR (role IN ('PARENT_ADMIN', 'PARENT') AND child_id IS NULL)",
            name="user_role_child_link",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), nullable=False)
    child_id: Mapped[int | None] = mapped_column(ForeignKey("children.id", ondelete="SET NULL"), nullable=True, index=True)


class Module(Base):
    __tablename__ = "modules"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HouseholdModuleAccess(TimestampMixin, Base):
    __tablename__ = "household_module_access"

    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class UserModuleAccess(TimestampMixin, Base):
    __tablename__ = "user_module_access"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), primary_key=True)
    can_view: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_manage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Tag(TimestampMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("household_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Chore(TimestampMixin, Base):
    __tablename__ = "chores"
    __table_args__ = (
        CheckConstraint("reward_cents >= 0", name="reward_non_negative"),
        CheckConstraint("schedule_interval IS NULL OR schedule_interval > 0", name="positive_schedule_interval"),
        CheckConstraint("timeout_days IS NULL OR timeout_days > 0", name="positive_timeout_days"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reward_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    timeout_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    schedule_mode: Mapped[ScheduleMode] = mapped_column(Enum(ScheduleMode, native_enum=False), nullable=False)
    schedule_interval: Mapped[int | None] = mapped_column(Integer, nullable=True)
    schedule_unit: Mapped[ScheduleUnit | None] = mapped_column(Enum(ScheduleUnit, native_enum=False), nullable=True)
    completion_mode: Mapped[CompletionMode] = mapped_column(Enum(CompletionMode, native_enum=False), nullable=False)
    assignment_mode: Mapped[AssignmentMode] = mapped_column(Enum(AssignmentMode, native_enum=False), nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ChoreAllowedChild(Base):
    __tablename__ = "chore_allowed_children"

    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)


class ChoreRotationMember(Base):
    __tablename__ = "chore_rotation_members"
    __table_args__ = (UniqueConstraint("chore_id", "position"),)

    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class ChoreRotationState(Base):
    __tablename__ = "chore_rotation_state"

    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), primary_key=True)
    current_position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_occurrence_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Submission(TimestampMixin, Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    for_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus, native_enum=False), nullable=False, default=SubmissionStatus.PENDING)


class SubmissionItem(Base):
    __tablename__ = "submission_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus, native_enum=False), nullable=False, default=SubmissionStatus.PENDING)


class CompletionRecord(Base):
    __tablename__ = "completion_records"
    __table_args__ = (UniqueConstraint("child_id", "chore_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[CompletionStatus] = mapped_column(Enum(CompletionStatus, native_enum=False), nullable=False)


class Transaction(TimestampMixin, Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType, native_enum=False), nullable=False)


class HomeschoolSemester(TimestampMixin, Base):
    __tablename__ = "homeschool_semesters"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HomeschoolSubject(TimestampMixin, Base):
    __tablename__ = "homeschool_subjects"
    __table_args__ = (UniqueConstraint("household_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HomeschoolAttendance(TimestampMixin, Base):
    __tablename__ = "homeschool_attendance"
    __table_args__ = (UniqueConstraint("child_id", "subject_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("homeschool_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    present: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    comment: Mapped[str] = mapped_column(String(2000), nullable=False, default="")


class HomeschoolDayComment(TimestampMixin, Base):
    __tablename__ = "homeschool_day_comments"
    __table_args__ = (UniqueConstraint("child_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    comment: Mapped[str] = mapped_column(String(4000), nullable=False, default="")


class HomeschoolGrade(TimestampMixin, Base):
    __tablename__ = "homeschool_grades"
    __table_args__ = (UniqueConstraint("child_id", "subject_id", "semester_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("homeschool_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    semester_id: Mapped[int | None] = mapped_column(ForeignKey("homeschool_semesters.id", ondelete="CASCADE"), nullable=True, index=True)
    grade: Mapped[str] = mapped_column(String(64), nullable=False, default="")


class HomeschoolCourse(TimestampMixin, Base):
    __tablename__ = "homeschool_courses"
    __table_args__ = (
        CheckConstraint("grade_level >= 1 AND grade_level <= 5", name="homeschool_course_grade_level_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_area: Mapped[HomeschoolSubjectArea] = mapped_column(Enum(HomeschoolSubjectArea, native_enum=False), nullable=False, index=True)
    grade_level: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(3000), nullable=False, default="")
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#3b82f6")
    icon: Mapped[str] = mapped_column(String(64), nullable=False, default="book-open")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class HomeschoolCourseAssignment(Base):
    __tablename__ = "homeschool_course_assignments"

    course_id: Mapped[int] = mapped_column(ForeignKey("homeschool_courses.id", ondelete="CASCADE"), primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)


class HomeschoolLesson(TimestampMixin, Base):
    __tablename__ = "homeschool_lessons"
    __table_args__ = (
        UniqueConstraint("course_id", "sequence_order"),
        CheckConstraint("sequence_order > 0", name="homeschool_lesson_positive_sequence"),
        CheckConstraint("estimated_minutes IS NULL OR estimated_minutes > 0", name="homeschool_lesson_positive_minutes"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("homeschool_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    overview: Mapped[str] = mapped_column(String(5000), nullable=False, default="")
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    activity_prompt: Mapped[str] = mapped_column(String(5000), nullable=False, default="")
    answer_key: Mapped[str] = mapped_column(String(5000), nullable=False, default="")
    learning_objectives: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    materials: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    warm_up: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    direct_instruction: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    guided_practice: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    independent_practice: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    assessment: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    extension: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    remediation: Mapped[str] = mapped_column(String(12000), nullable=False, default="")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class HomeschoolLessonProgress(TimestampMixin, Base):
    __tablename__ = "homeschool_lesson_progress"
    __table_args__ = (
        UniqueConstraint("child_id", "lesson_id"),
        CheckConstraint("score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)", name="homeschool_progress_score_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("homeschool_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("homeschool_lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[HomeschoolProgressStatus] = mapped_column(
        Enum(HomeschoolProgressStatus, native_enum=False),
        nullable=False,
        default=HomeschoolProgressStatus.NOT_STARTED,
    )
    score_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(String(3000), nullable=False, default="")


class QuickTemplate(TimestampMixin, Base):
    __tablename__ = "quick_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reward_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_mode: Mapped[CompletionMode] = mapped_column(Enum(CompletionMode, native_enum=False), nullable=False)


ALL_MODELS = (
    Household,
    Child,
    User,
    Module,
    HouseholdModuleAccess,
    UserModuleAccess,
    Tag,
    Chore,
    ChoreAllowedChild,
    ChoreRotationMember,
    ChoreRotationState,
    Submission,
    SubmissionItem,
    CompletionRecord,
    Transaction,
    HomeschoolSemester,
    HomeschoolSubject,
    HomeschoolAttendance,
    HomeschoolDayComment,
    HomeschoolGrade,
    HomeschoolCourse,
    HomeschoolCourseAssignment,
    HomeschoolLesson,
    HomeschoolLessonProgress,
    QuickTemplate,
)
