"""Add digest-backed password reset capabilities and secret-free mail outbox.

Revision ID: 20260811_0017
Revises: 20260719_0016
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260811_0017"
down_revision = "20260719_0016"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # Historical subsystem-only test fixtures intentionally omit Family Manager
    # identity tables. There is no reset state to migrate in those databases.
    if "users" not in tables:
        return

    if "password_resets" not in tables:
        op.create_table(
            "password_resets",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token_key_version", sa.String(length=64), nullable=False),
            sa.Column("token_digest", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
            *_timestamps(),
            sa.CheckConstraint("length(token_key_version) > 0", name="password_reset_token_key_version_nonempty"),
            sa.CheckConstraint("length(token_digest) = 64", name="password_reset_token_digest_length"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="fk_password_resets_user_id_users"),
            sa.PrimaryKeyConstraint("id", name="pk_password_resets"),
            sa.UniqueConstraint("token_digest", name="uq_password_resets_token_digest"),
        )
        op.create_index("ix_password_resets_user_id", "password_resets", ["user_id"])
        op.create_index("ix_password_resets_expires_at", "password_resets", ["expires_at"])
        op.create_index("ix_password_resets_consumed_at", "password_resets", ["consumed_at"])
        op.create_index("ix_password_resets_invalidated_at", "password_resets", ["invalidated_at"])
        op.create_index(
            "uq_password_resets_one_active_user",
            "password_resets",
            ["user_id"],
            unique=True,
            sqlite_where=sa.text("consumed_at IS NULL AND invalidated_at IS NULL"),
            postgresql_where=sa.text("consumed_at IS NULL AND invalidated_at IS NULL"),
        )

    if "password_reset_requests" not in tables:
        op.create_table(
            "password_reset_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("household_id", sa.Integer(), nullable=True),
            sa.Column("email_key_hash", sa.String(length=64), nullable=False),
            sa.Column("ip_key_hash", sa.String(length=64), nullable=False),
            sa.Column("outcome", sa.String(length=64), nullable=False),
            *_timestamps(),
            sa.CheckConstraint("length(email_key_hash) = 64", name="password_reset_request_email_key_hash_length"),
            sa.CheckConstraint("length(ip_key_hash) = 64", name="password_reset_request_ip_key_hash_length"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL", name="fk_password_reset_requests_user_id_users"),
            sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="SET NULL", name="fk_password_reset_requests_household_id_households"),
            sa.PrimaryKeyConstraint("id", name="pk_password_reset_requests"),
        )
        op.create_index("ix_password_reset_requests_user_id", "password_reset_requests", ["user_id"])
        op.create_index("ix_password_reset_requests_household_id", "password_reset_requests", ["household_id"])
        op.create_index("ix_password_reset_requests_email_created", "password_reset_requests", ["email_key_hash", "created_at"])
        op.create_index("ix_password_reset_requests_ip_created", "password_reset_requests", ["ip_key_hash", "created_at"])
        op.create_index("ix_password_reset_requests_household_created", "password_reset_requests", ["household_id", "created_at"])

    if "password_reset_deliveries" not in tables:
        op.create_table(
            "password_reset_deliveries",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("password_reset_id", sa.String(length=64), nullable=False),
            sa.Column("kind", sa.String(length=32), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("accepted_by_mta_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("terminal_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error_code", sa.String(length=64), nullable=False, server_default=""),
            *_timestamps(),
            sa.CheckConstraint("kind IN ('reset_link', 'password_changed')", name="password_reset_delivery_kind"),
            sa.CheckConstraint(
                "status IN ('pending', 'processing', 'retry', 'accepted', 'cancelled', 'dead')",
                name="password_reset_delivery_status",
            ),
            sa.CheckConstraint("attempt_count >= 0", name="password_reset_delivery_attempt_count_nonnegative"),
            sa.ForeignKeyConstraint(["password_reset_id"], ["password_resets.id"], ondelete="CASCADE", name="fk_password_reset_deliveries_password_reset_id_password_resets"),
            sa.PrimaryKeyConstraint("id", name="pk_password_reset_deliveries"),
            sa.UniqueConstraint("password_reset_id", "kind", name="uq_password_reset_deliveries_reset_kind"),
        )
        op.create_index("ix_password_reset_deliveries_password_reset_id", "password_reset_deliveries", ["password_reset_id"])
        op.create_index("ix_password_reset_deliveries_status_available", "password_reset_deliveries", ["status", "available_at"])
        op.create_index("ix_password_reset_deliveries_lease_expires_at", "password_reset_deliveries", ["lease_expires_at"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    for table in ("password_reset_deliveries", "password_reset_requests", "password_resets"):
        if table in tables:
            op.drop_table(table)
