"""Harden notification visibility and delivery queue uniqueness.

Revision ID: 20260714_0012
Revises: 20260618_0011
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260714_0012"
down_revision = "20260618_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use SQLite-native operations rather than batch reflection so this
    # migration can repair historical databases created by the old partial
    # baseline, where referenced legacy tables may not exist.
    op.add_column(
        "notifications",
        sa.Column("in_app_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.execute(
        sa.text(
            """
            DELETE FROM notification_delivery_attempts
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM notification_delivery_attempts
                GROUP BY notification_id, channel
            )
            """
        )
    )
    op.create_index(
        "uq_notification_delivery_attempt_channel",
        "notification_delivery_attempts",
        ["notification_id", "channel"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_notification_delivery_attempt_channel", table_name="notification_delivery_attempts")
    op.drop_column("notifications", "in_app_visible")
