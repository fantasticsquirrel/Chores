"""Add revocable sessions, login throttling, and security audit storage.

Revision ID: 20260714_0013
Revises: 20260714_0012
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260714_0013"
down_revision = "20260714_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # can_manage existed before it was enforced. Preserve each historical
    # user's effective capabilities, then allow explicit view-only choices.
    op.execute(sa.text("UPDATE user_module_access SET can_manage = can_view"))

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()))

    with op.batch_alter_table("completion_records") as batch_op:
        batch_op.add_column(sa.Column("occurrence_key", sa.String(length=160), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE completion_records AS current
            SET occurrence_key =
                CASE
                    WHEN (SELECT completion_mode FROM chores WHERE chores.id = current.chore_id) = 'SHARED'
                    THEN 'household:' || current.household_id || ':chore:' || current.chore_id || ':date:' || current.date
                    ELSE 'child:' || current.child_id || ':chore:' || current.chore_id || ':date:' || current.date
                END ||
                CASE WHEN current.id != (
                    SELECT MIN(other.id)
                    FROM completion_records AS other
                    WHERE other.chore_id = current.chore_id
                      AND other.date = current.date
                      AND (
                        ((SELECT completion_mode FROM chores WHERE chores.id = current.chore_id) = 'SHARED' AND other.household_id = current.household_id)
                        OR ((SELECT completion_mode FROM chores WHERE chores.id = current.chore_id) != 'SHARED' AND other.child_id = current.child_id)
                      )
                ) THEN ':legacy:' || current.id ELSE '' END
            """
        )
    )
    with op.batch_alter_table("completion_records") as batch_op:
        batch_op.create_unique_constraint("uq_completion_records_occurrence_key", ["occurrence_key"])

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("completion_record_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_transactions_completion_record_id_completion_records",
            "completion_records",
            ["completion_record_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index("ix_transactions_completion_record_id", "transactions", ["completion_record_id"], unique=True)

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("user_agent", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_token_hash", "auth_sessions", ["token_hash"], unique=True)
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
    op.create_index("ix_auth_sessions_revoked_at", "auth_sessions", ["revoked_at"])

    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_key_hash", sa.String(length=64), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=False),
        sa.Column("succeeded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_login_attempts_account_key_hash", "login_attempts", ["account_key_hash"])
    op.create_index("ix_login_attempts_ip_address", "login_attempts", ["ip_address"])

    op.create_table(
        "security_audit_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("household_id", sa.Integer(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=False, server_default="unknown"),
        sa.Column("details_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_security_audit_events_event_type", "security_audit_events", ["event_type"])
    op.create_index("ix_security_audit_events_actor_user_id", "security_audit_events", ["actor_user_id"])
    op.create_index("ix_security_audit_events_target_user_id", "security_audit_events", ["target_user_id"])
    op.create_index("ix_security_audit_events_household_id", "security_audit_events", ["household_id"])


def downgrade() -> None:
    op.drop_table("security_audit_events")
    op.drop_table("login_attempts")
    op.drop_table("auth_sessions")
    op.drop_index("ix_transactions_completion_record_id", table_name="transactions")
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_constraint("fk_transactions_completion_record_id_completion_records", type_="foreignkey")
        batch_op.drop_column("completion_record_id")
    with op.batch_alter_table("completion_records") as batch_op:
        batch_op.drop_constraint("uq_completion_records_occurrence_key", type_="unique")
        batch_op.drop_column("occurrence_key")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("active")
