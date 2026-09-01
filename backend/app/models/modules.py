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


