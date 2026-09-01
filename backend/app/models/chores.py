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
    # Null means a child/household chore. A parent user id means a personal,
    # money-free recurring task owned by that parent account.
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
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
    __table_args__ = (
        UniqueConstraint("child_id", "chore_id", "date"),
        UniqueConstraint("occurrence_key", name="uq_completion_records_occurrence_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), nullable=False, index=True)
    occurrence_key: Mapped[str | None] = mapped_column(String(160), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[CompletionStatus] = mapped_column(Enum(CompletionStatus, native_enum=False), nullable=False)


class ParentChoreCompletion(TimestampMixin, Base):
    __tablename__ = "parent_chore_completions"
    __table_args__ = (UniqueConstraint("chore_id", "user_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_id: Mapped[int] = mapped_column(ForeignKey("chores.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)


class Transaction(TimestampMixin, Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    completion_record_id: Mapped[int | None] = mapped_column(
        ForeignKey("completion_records.id", ondelete="SET NULL"), nullable=True, unique=True, index=True
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType, native_enum=False), nullable=False)
    memo: Mapped[str] = mapped_column(String(500), nullable=False, default="", server_default="")
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )


