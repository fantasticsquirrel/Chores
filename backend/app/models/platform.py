from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin
from app.models.enums import PlatformRole


class PlatformUser(TimestampMixin, Base):
    __tablename__ = "platform_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[PlatformRole] = mapped_column(Enum(PlatformRole, native_enum=False), nullable=False)
    totp_secret_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    totp_key_version: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    @property
    def totp_secret(self) -> str:
        from app.security.totp_crypto import decrypt_totp_secret
        return decrypt_totp_secret(self.totp_secret_ciphertext, self.totp_key_version)

    @totp_secret.setter
    def totp_secret(self, value: str) -> None:
        from app.config import get_settings
        from app.security.totp_crypto import encrypt_totp_secret
        self.totp_secret_ciphertext = encrypt_totp_secret(value)
        self.totp_key_version = get_settings().platform_totp_active_key_version


class PlatformSession(TimestampMixin, Base):
    __tablename__ = "platform_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform_user_id: Mapped[int] = mapped_column(ForeignKey("platform_users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mfa_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recent_reauth_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PlatformAuditEvent(TimestampMixin, Base):
    __tablename__ = "platform_audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    actor_platform_user_id: Mapped[int | None] = mapped_column(ForeignKey("platform_users.id", ondelete="SET NULL"), nullable=True, index=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    details_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")


class SupportCase(TimestampMixin, Base):
    __tablename__ = "support_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="RESTRICT"), nullable=False, index=True)
    opened_by_platform_user_id: Mapped[int] = mapped_column(ForeignKey("platform_users.id", ondelete="RESTRICT"), nullable=False)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")


class SupportCaseNote(TimestampMixin, Base):
    __tablename__ = "support_case_notes"
    __table_args__ = (UniqueConstraint("case_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("support_cases.id", ondelete="RESTRICT"), nullable=False, index=True)
    author_platform_user_id: Mapped[int] = mapped_column(ForeignKey("platform_users.id", ondelete="RESTRICT"), nullable=False)
    body: Mapped[str] = mapped_column(String(4000), nullable=False)


def _immutable(*_: object, **__: object) -> None:
    raise ValueError("append-only record")


for _model in (PlatformAuditEvent, SupportCaseNote):
    event.listen(_model, "before_update", _immutable)
    event.listen(_model, "before_delete", _immutable)
