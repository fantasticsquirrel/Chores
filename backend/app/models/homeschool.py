from __future__ import annotations

from datetime import UTC, date, datetime
import secrets

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin
from app.models.enums import (
    AssignmentMode,
    CompletionMode,
    CompletionStatus,
    ScheduleMode,
    ScheduleUnit,
    SubmissionStatus,
    TransactionType,
    UserRole,
)

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


