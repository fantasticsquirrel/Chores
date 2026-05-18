"""Add Family Manager module access tables.

Revision ID: 20260518_0002
Revises: 20260223_0001
Create Date: 2026-05-18 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260518_0002"
down_revision = "20260223_0001"
branch_labels = None
depends_on = None

MODULE_ROWS = (
    ("chores", "Chores", "Chore assignments, child submissions, approvals, and rewards.", True),
    ("homeschool", "Homeschool", "Attendance, subjects, semesters, comments, and homeschool reporting.", True),
    ("admin", "Admin", "Household users, children, account links, and module access.", True),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "modules" not in tables:
        op.create_table(
            "modules",
            sa.Column("key", sa.String(length=64), primary_key=True),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        )

    if "household_module_access" not in tables:
        op.create_table(
            "household_module_access",
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("module_key", sa.String(length=64), sa.ForeignKey("modules.key", ondelete="CASCADE"), primary_key=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    if "user_module_access" not in tables:
        op.create_table(
            "user_module_access",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("module_key", sa.String(length=64), sa.ForeignKey("modules.key", ondelete="CASCADE"), primary_key=True),
            sa.Column("can_view", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("can_manage", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    for key, name, description, enabled in MODULE_ROWS:
        bind.execute(
            sa.text(
                "INSERT OR IGNORE INTO modules (key, name, description, enabled) "
                "VALUES (:key, :name, :description, :enabled)"
            ),
            {"key": key, "name": name, "description": description, "enabled": enabled},
        )


def downgrade() -> None:
    op.drop_table("user_module_access")
    op.drop_table("household_module_access")
    op.drop_table("modules")
