"""Add homeschool notes and grades.

Revision ID: 20260518_0004
Revises: 20260518_0003
Create Date: 2026-05-18 01:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260518_0004"
down_revision = "20260518_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "homeschool_day_comments" not in tables:
        op.create_table(
            "homeschool_day_comments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("comment", sa.String(length=4000), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("child_id", "date", name="uq_homeschool_day_comments_child_date"),
        )
        op.create_index("ix_homeschool_day_comments_household_id", "homeschool_day_comments", ["household_id"])
        op.create_index("ix_homeschool_day_comments_child_id", "homeschool_day_comments", ["child_id"])

    if "homeschool_grades" not in tables:
        op.create_table(
            "homeschool_grades",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
            sa.Column("subject_id", sa.Integer(), sa.ForeignKey("homeschool_subjects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("semester_id", sa.Integer(), sa.ForeignKey("homeschool_semesters.id", ondelete="CASCADE"), nullable=True),
            sa.Column("grade", sa.String(length=64), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("child_id", "subject_id", "semester_id", name="uq_homeschool_grades_child_subject_semester"),
        )
        op.create_index("ix_homeschool_grades_household_id", "homeschool_grades", ["household_id"])
        op.create_index("ix_homeschool_grades_child_id", "homeschool_grades", ["child_id"])


def downgrade() -> None:
    op.drop_table("homeschool_grades")
    op.drop_table("homeschool_day_comments")
