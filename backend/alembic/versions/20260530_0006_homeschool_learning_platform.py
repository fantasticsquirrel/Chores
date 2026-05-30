"""Add homeschool learning platform tables.

Revision ID: 20260530_0006
Revises: 20260518_0005
Create Date: 2026-05-30 12:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260530_0006"
down_revision = "20260518_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "homeschool_courses" not in tables:
        op.create_table(
            "homeschool_courses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("subject_area", sa.String(length=32), nullable=False),
            sa.Column("grade_level", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.String(length=3000), nullable=False, server_default=""),
            sa.Column("color", sa.String(length=32), nullable=False, server_default="#3b82f6"),
            sa.Column("icon", sa.String(length=64), nullable=False, server_default="book-open"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("grade_level >= 1 AND grade_level <= 5", name="ck_homeschool_courses_grade_level_range"),
        )
        op.create_index("ix_homeschool_courses_household_id", "homeschool_courses", ["household_id"])
        op.create_index("ix_homeschool_courses_subject_area", "homeschool_courses", ["subject_area"])

    if "homeschool_course_assignments" not in tables:
        op.create_table(
            "homeschool_course_assignments",
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("homeschool_courses.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
        )

    if "homeschool_lessons" not in tables:
        op.create_table(
            "homeschool_lessons",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("homeschool_courses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("overview", sa.String(length=5000), nullable=False, server_default=""),
            sa.Column("sequence_order", sa.Integer(), nullable=False),
            sa.Column("estimated_minutes", sa.Integer(), nullable=True),
            sa.Column("activity_prompt", sa.String(length=5000), nullable=False, server_default=""),
            sa.Column("answer_key", sa.String(length=5000), nullable=False, server_default=""),
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("course_id", "sequence_order", name="uq_homeschool_lessons_course_sequence"),
            sa.CheckConstraint("sequence_order > 0", name="ck_homeschool_lessons_positive_sequence"),
            sa.CheckConstraint("estimated_minutes IS NULL OR estimated_minutes > 0", name="ck_homeschool_lessons_positive_minutes"),
        )
        op.create_index("ix_homeschool_lessons_household_id", "homeschool_lessons", ["household_id"])
        op.create_index("ix_homeschool_lessons_course_id", "homeschool_lessons", ["course_id"])

    if "homeschool_lesson_progress" not in tables:
        op.create_table(
            "homeschool_lesson_progress",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False),
            sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("homeschool_courses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("homeschool_lessons.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="NOT_STARTED"),
            sa.Column("score_percent", sa.Integer(), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.String(length=3000), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("child_id", "lesson_id", name="uq_homeschool_lesson_progress_child_lesson"),
            sa.CheckConstraint(
                "score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)",
                name="ck_homeschool_lesson_progress_score_range",
            ),
        )
        op.create_index("ix_homeschool_lesson_progress_household_id", "homeschool_lesson_progress", ["household_id"])
        op.create_index("ix_homeschool_lesson_progress_child_id", "homeschool_lesson_progress", ["child_id"])
        op.create_index("ix_homeschool_lesson_progress_course_id", "homeschool_lesson_progress", ["course_id"])
        op.create_index("ix_homeschool_lesson_progress_lesson_id", "homeschool_lesson_progress", ["lesson_id"])


def downgrade() -> None:
    op.drop_table("homeschool_lesson_progress")
    op.drop_table("homeschool_lessons")
    op.drop_table("homeschool_course_assignments")
    op.drop_table("homeschool_courses")
