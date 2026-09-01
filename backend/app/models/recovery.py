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

def _password_reset_id() -> str:
    """Return an unguessable internal identifier for a reset capability."""
    return secrets.token_urlsafe(32)


class PasswordReset(TimestampMixin, Base):
    """A one-time, digest-backed password reset capability.

    The raw proof is never persisted. It is deterministically derived from this
    random identifier and the recorded versioned HMAC key only by the reset
    service/worker when needed.
    """

    __tablename__ = "password_resets"
    __table_args__ = (
        CheckConstraint("length(token_key_version) > 0", name="password_reset_token_key_version_nonempty"),
        CheckConstraint("length(token_digest) = 64", name="password_reset_token_digest_length"),
        UniqueConstraint("token_digest", name="uq_password_resets_token_digest"),
        Index("ix_password_resets_user_id", "user_id"),
        Index("ix_password_resets_expires_at", "expires_at"),
        Index("ix_password_resets_consumed_at", "consumed_at"),
        Index("ix_password_resets_invalidated_at", "invalidated_at"),
        Index(
            "uq_password_resets_one_active_user",
            "user_id",
            unique=True,
            sqlite_where=text("consumed_at IS NULL AND invalidated_at IS NULL"),
            postgresql_where=text("consumed_at IS NULL AND invalidated_at IS NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_password_reset_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_key_version: Mapped[str] = mapped_column(String(64), nullable=False)
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PasswordResetRequest(TimestampMixin, Base):
    """Redacted reset-request history used only for abuse controls."""

    __tablename__ = "password_reset_requests"
    __table_args__ = (
        CheckConstraint("length(email_key_hash) = 64", name="password_reset_request_email_key_hash_length"),
        CheckConstraint("length(ip_key_hash) = 64", name="password_reset_request_ip_key_hash_length"),
        Index("ix_password_reset_requests_user_id", "user_id"),
        Index("ix_password_reset_requests_household_id", "household_id"),
        Index("ix_password_reset_requests_email_created", "email_key_hash", "created_at"),
        Index("ix_password_reset_requests_ip_created", "ip_key_hash", "created_at"),
        Index("ix_password_reset_requests_household_created", "household_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id", ondelete="SET NULL"), nullable=True)
    email_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    ip_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    outcome: Mapped[str] = mapped_column(String(64), nullable=False)


class PasswordResetDelivery(TimestampMixin, Base):
    """Secret-free local-MTA handoff state for reset security mail."""

    __tablename__ = "password_reset_deliveries"
    __table_args__ = (
        CheckConstraint("kind IN ('reset_link', 'password_changed')", name="password_reset_delivery_kind"),
        CheckConstraint(
            "status IN ('pending', 'processing', 'retry', 'accepted', 'cancelled', 'dead')",
            name="password_reset_delivery_status",
        ),
        CheckConstraint("attempt_count >= 0", name="password_reset_delivery_attempt_count_nonnegative"),
        UniqueConstraint("password_reset_id", "kind", name="uq_password_reset_deliveries_reset_kind"),
        Index("ix_password_reset_deliveries_password_reset_id", "password_reset_id"),
        Index("ix_password_reset_deliveries_status_available", "status", "available_at"),
        Index("ix_password_reset_deliveries_lease_expires_at", "lease_expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    password_reset_id: Mapped[str] = mapped_column(ForeignKey("password_resets.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by_mta_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    terminal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_code: Mapped[str] = mapped_column(String(64), nullable=False, default="")


class AccountRegistration(TimestampMixin, Base):
    """Unverified household-owner signup; no household/user exists until consumption."""

    __tablename__ = "account_registrations"
    __table_args__ = (
        UniqueConstraint("token_digest", name="uq_account_registrations_token_digest"),
        CheckConstraint("length(token_digest) = 64", name="account_registration_token_digest_length"),
        Index("ix_account_registrations_email_created", "email_key_hash", "created_at"),
        Index("ix_account_registrations_ip_created", "ip_key_hash", "created_at"),
        Index("ix_account_registrations_expires_at", "expires_at"),
        Index(
            "uq_account_registrations_one_active_email",
            "email_key_hash",
            unique=True,
            sqlite_where=text("consumed_at IS NULL AND invalidated_at IS NULL"),
            postgresql_where=text("consumed_at IS NULL AND invalidated_at IS NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_password_reset_id)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    ip_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    household_name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    token_key_version: Mapped[str] = mapped_column(String(64), nullable=False)
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AccountRegistrationDelivery(TimestampMixin, Base):
    __tablename__ = "account_registration_deliveries"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'processing', 'retry', 'accepted', 'cancelled', 'dead')",
            name="account_registration_delivery_status",
        ),
        UniqueConstraint("registration_id", name="uq_account_registration_deliveries_registration"),
        Index("ix_account_registration_deliveries_status_available", "status", "available_at"),
        Index("ix_account_registration_deliveries_lease_expires_at", "lease_expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    registration_id: Mapped[str] = mapped_column(ForeignKey("account_registrations.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by_mta_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    terminal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_code: Mapped[str] = mapped_column(String(64), nullable=False, default="")


