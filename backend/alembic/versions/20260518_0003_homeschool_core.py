"""Add core homeschool tables.

Revision ID: 20260518_0003
Revises: 20260518_0002
Create Date: 2026-05-18 00:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260518_0003"
down_revision = "20260518_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "homeschool_semesters" not in tables:
        op.create_table(
            "homeschool_semesters",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_homeschool_semesters_household_id", "homeschool_semesters", ["household_id"])

    if "homeschool_subjects" not in tables:
        op.create_table(
            "homeschool_subjects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("color", sa.String(length=32), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("household_id", "name", name="uq_homeschool_subjects_household_name"),
        )
        op.create_index("ix_homeschool_subjects_household_id", "homeschool_subjects", ["household_id"])

    if "homeschool_attendance" not in tables:
        op.create_table(
            "homeschool_attendance",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
            sa.Column("subject_id", sa.Integer(), sa.ForeignKey("homeschool_subjects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("present", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("comment", sa.String(length=2000), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("child_id", "subject_id", "date", name="uq_homeschool_attendance_child_subject_date"),
        )
        op.create_index("ix_homeschool_attendance_household_id", "homeschool_attendance", ["household_id"])
        op.create_index("ix_homeschool_attendance_child_id", "homeschool_attendance", ["child_id"])


def downgrade() -> None:
    op.drop_table("homeschool_attendance")
    op.drop_table("homeschool_subjects")
    op.drop_table("homeschool_semesters")
