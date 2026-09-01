from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin
from app.models.platform import SupportCase, SupportCaseNote


class SupportTicketLink(TimestampMixin, Base):
    __tablename__ = "support_ticket_links"
    __table_args__ = (
        UniqueConstraint("zammad_ticket_id"),
        UniqueConstraint("household_id", "idempotency_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    zammad_ticket_id: Mapped[int] = mapped_column(Integer, nullable=False)
    ticket_number: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    state: Mapped[str] = mapped_column(String(64), nullable=False, default="new")
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SupportWebhookReceipt(TimestampMixin, Base):
    __tablename__ = "support_webhook_receipts"

    event_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    zammad_ticket_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)


__all__ = ["SupportCase", "SupportCaseNote", "SupportTicketLink", "SupportWebhookReceipt"]
