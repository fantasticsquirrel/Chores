"""Add session-bound native push subscriptions without backfilling devices.

Revision ID: 20261005_0021
Revises: 20260830_0020
"""
from alembic import op
import sqlalchemy as sa

revision = "20261005_0021"
down_revision = "20260830_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Explicit historical schema, independent of current application metadata.
    # SQLite permits foreign-key declarations in sparse historical fixtures;
    # this adds no identity rows and never invents a token or device binding.
    op.create_table(
        "native_push_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("auth_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(224), nullable=False),
        sa.Column("platform", sa.String(7), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("token", name="uq_native_push_subscriptions_token"),
        sa.CheckConstraint("platform IN ('android', 'ios')", name="native_push_platform"),
    )
    op.create_index("ix_native_push_subscriptions_user_id", "native_push_subscriptions", ["user_id"])
    op.create_index("ix_native_push_subscriptions_session_id", "native_push_subscriptions", ["session_id"])


def downgrade() -> None:
    # Only this revision's new table is removed; browser push and identities
    # remain untouched. Operators must back up before discarding registrations.
    op.drop_table("native_push_subscriptions")
