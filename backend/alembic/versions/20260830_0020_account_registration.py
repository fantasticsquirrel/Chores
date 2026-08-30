"""Add verified public account registration.

Revision ID: 20260830_0020
Revises: 20260829_0019
"""
from alembic import op
import sqlalchemy as sa

revision = "20260830_0020"
down_revision = "20260829_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_registrations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("email_key_hash", sa.String(64), nullable=False),
        sa.Column("ip_key_hash", sa.String(64), nullable=False),
        sa.Column("household_name", sa.String(255), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("token_key_version", sa.String(64), nullable=False),
        sa.Column("token_digest", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("invalidated_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("length(token_digest) = 64", name="account_registration_token_digest_length"),
        sa.UniqueConstraint("token_digest", name="uq_account_registrations_token_digest"),
    )
    op.create_index("ix_account_registrations_email_created", "account_registrations", ["email_key_hash", "created_at"])
    op.create_index("ix_account_registrations_ip_created", "account_registrations", ["ip_key_hash", "created_at"])
    op.create_index("ix_account_registrations_expires_at", "account_registrations", ["expires_at"])
    op.create_index("uq_account_registrations_one_active_email", "account_registrations", ["email_key_hash"], unique=True, sqlite_where=sa.text("consumed_at IS NULL AND invalidated_at IS NULL"), postgresql_where=sa.text("consumed_at IS NULL AND invalidated_at IS NULL"))
    op.create_table(
        "account_registration_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("registration_id", sa.String(64), sa.ForeignKey("account_registrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("accepted_by_mta_at", sa.DateTime(timezone=True)),
        sa.Column("terminal_at", sa.DateTime(timezone=True)),
        sa.Column("last_error_code", sa.String(64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'processing', 'retry', 'accepted', 'cancelled', 'dead')", name="account_registration_delivery_status"),
        sa.UniqueConstraint("registration_id", name="uq_account_registration_deliveries_registration"),
    )
    op.create_index("ix_account_registration_deliveries_status_available", "account_registration_deliveries", ["status", "available_at"])
    op.create_index("ix_account_registration_deliveries_lease_expires_at", "account_registration_deliveries", ["lease_expires_at"])


def downgrade() -> None:
    op.drop_table("account_registration_deliveries")
    op.drop_table("account_registrations")
