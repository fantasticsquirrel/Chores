"""Retained storage contract only; no ORM relationships, routes or DTOs.

These historical tables are not an active homeschool feature. Registering exact
Table metadata prevents schema tools from treating retained history as garbage.
"""
from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String,
    Table, UniqueConstraint, text,
)

from app.db import Base


homeschool_courses = Table(
    "homeschool_courses", Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("household_id", Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("subject_area", String(10), nullable=False, index=True),
    Column("grade_level", Integer, nullable=False),
    Column("title", String(255), nullable=False),
    Column("description", String(3000), nullable=False),
    Column("color", String(32), nullable=False),
    Column("icon", String(64), nullable=False),
    Column("active", Boolean, nullable=False),
    Column("archived_at", DateTime),
    Column("created_at", DateTime, nullable=False),
    CheckConstraint("grade_level >= 1 AND grade_level <= 5", name="homeschool_course_grade_level_range"),
)

homeschool_lessons = Table(
    "homeschool_lessons", Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("household_id", Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("course_id", Integer, ForeignKey("homeschool_courses.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("title", String(255), nullable=False),
    Column("overview", String(5000), nullable=False),
    Column("sequence_order", Integer, nullable=False),
    Column("estimated_minutes", Integer),
    Column("activity_prompt", String(5000), nullable=False),
    Column("answer_key", String(5000), nullable=False),
    Column("archived_at", DateTime),
    Column("created_at", DateTime, nullable=False),
    Column("learning_objectives", String(12000), nullable=False, server_default=text("''")),
    Column("materials", String(12000), nullable=False, server_default=text("''")),
    Column("warm_up", String(12000), nullable=False, server_default=text("''")),
    Column("direct_instruction", String(12000), nullable=False, server_default=text("''")),
    Column("guided_practice", String(12000), nullable=False, server_default=text("''")),
    Column("independent_practice", String(12000), nullable=False, server_default=text("''")),
    Column("assessment", String(12000), nullable=False, server_default=text("''")),
    Column("extension", String(12000), nullable=False, server_default=text("''")),
    Column("remediation", String(12000), nullable=False, server_default=text("''")),
    UniqueConstraint("course_id", "sequence_order"),
    CheckConstraint("sequence_order > 0", name="homeschool_lesson_positive_sequence"),
    CheckConstraint("estimated_minutes IS NULL OR estimated_minutes > 0", name="homeschool_lesson_positive_minutes"),
)

homeschool_course_assignments = Table(
    "homeschool_course_assignments", Base.metadata,
    Column("course_id", Integer, ForeignKey("homeschool_courses.id", ondelete="CASCADE"), primary_key=True),
    Column("child_id", Integer, ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
)

homeschool_lesson_progress = Table(
    "homeschool_lesson_progress", Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("household_id", Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("child_id", Integer, ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("course_id", Integer, ForeignKey("homeschool_courses.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("lesson_id", Integer, ForeignKey("homeschool_lessons.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("status", String(12), nullable=False),
    Column("score_percent", Integer),
    Column("completed_at", DateTime),
    Column("notes", String(3000), nullable=False),
    Column("created_at", DateTime, nullable=False),
    UniqueConstraint("child_id", "lesson_id"),
    CheckConstraint("score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)", name="homeschool_progress_score_range"),
)

RETAINED_HOMESCHOOL_TABLES = (
    homeschool_courses, homeschool_lessons,
    homeschool_course_assignments, homeschool_lesson_progress,
)
