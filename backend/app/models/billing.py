from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin
from app.models.enums import EntitlementStatus


class BillingAccount(TimestampMixin, Base):
    __tablename__ = "billing_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    public_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    billing_account_id: Mapped[int] = mapped_column(ForeignKey("billing_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan_key: Mapped[str] = mapped_column(String(64), nullable=False, default="family_plus")
    status: Mapped[EntitlementStatus] = mapped_column(Enum(EntitlementStatus, native_enum=False), nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BillingCustomerReference(TimestampMixin, Base):
    __tablename__ = "billing_customer_references"
    __table_args__ = (UniqueConstraint("provider", "provider_customer_id", name="uq_billing_customer_references_provider_customer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    billing_account_id: Mapped[int] = mapped_column(ForeignKey("billing_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_customer_id: Mapped[str] = mapped_column(String(255), nullable=False)


class BillingEvent(TimestampMixin, Base):
    __tablename__ = "billing_events"
    __table_args__ = (UniqueConstraint("source", "idempotency_key", name="uq_billing_events_source_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    billing_account_id: Mapped[int] = mapped_column(ForeignKey("billing_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")


class HouseholdEntitlement(TimestampMixin, Base):
    __tablename__ = "household_entitlements"

    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    billing_account_id: Mapped[int] = mapped_column(ForeignKey("billing_accounts.id", ondelete="CASCADE"), nullable=False, unique=True)
    plan_key: Mapped[str] = mapped_column(String(64), nullable=False, default="family_plus")
    status: Mapped[EntitlementStatus] = mapped_column(Enum(EntitlementStatus, native_enum=False), nullable=False, default=EntitlementStatus.NONE)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    projected_event_id: Mapped[int | None] = mapped_column(ForeignKey("billing_events.id", ondelete="RESTRICT"), nullable=True)
    projected_occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


def _immutable(*_: object, **__: object) -> None:
    raise ValueError("billing events are immutable")


event.listen(BillingEvent, "before_update", _immutable)
event.listen(BillingEvent, "before_delete", _immutable)
