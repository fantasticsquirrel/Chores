"""Add detailed homeschool lesson plan fields.

Revision ID: 20260530_0007
Revises: 20260530_0006
Create Date: 2026-05-30 14:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260530_0007"
down_revision = "20260530_0006"
branch_labels = None
depends_on = None


_LESSON_PLAN_COLUMNS = (
    "learning_objectives",
    "materials",
    "warm_up",
    "direct_instruction",
    "guided_practice",
    "independent_practice",
    "assessment",
    "extension",
    "remediation",
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "homeschool_lessons" not in tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("homeschool_lessons")}
    for column_name in _LESSON_PLAN_COLUMNS:
        if column_name in existing_columns:
            continue
        op.add_column(
            "homeschool_lessons",
            sa.Column(column_name, sa.String(length=12000), nullable=False, server_default=""),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "homeschool_lessons" not in tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("homeschool_lessons")}
    for column_name in reversed(_LESSON_PLAN_COLUMNS):
        if column_name in existing_columns:
            op.drop_column("homeschool_lessons", column_name)
