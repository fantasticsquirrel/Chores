"""Add Zammad support ticket links.

Revision ID: 20260901_0021
Revises: 20260830_0020
"""
from alembic import op
import sqlalchemy as sa

revision = "20260901_0021"
down_revision = "20260830_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_ticket_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("zammad_ticket_id", sa.Integer(), nullable=False),
        sa.Column("ticket_number", sa.String(64), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("state", sa.String(64), nullable=False, server_default="new"),
        sa.Column("idempotency_key", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("zammad_ticket_id"),
        sa.UniqueConstraint("household_id", "idempotency_key"),
    )
    op.create_index("ix_support_ticket_links_household_id", "support_ticket_links", ["household_id"])
    op.create_index("ix_support_ticket_links_user_id", "support_ticket_links", ["user_id"])
    op.create_table(
        "support_webhook_receipts",
        sa.Column("event_digest", sa.String(64), primary_key=True),
        sa.Column("zammad_ticket_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_support_webhook_receipts_zammad_ticket_id", "support_webhook_receipts", ["zammad_ticket_id"])


def downgrade() -> None:
    op.drop_table("support_webhook_receipts")
    op.drop_table("support_ticket_links")

