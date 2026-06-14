"""add recipe feedback

Revision ID: 20260614_0009
Revises: 20260614_0008
Create Date: 2026-06-14 16:55:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260614_0009"
down_revision = "20260614_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_type", sa.String(length=16), nullable=False),
        sa.Column("reviewer_key", sa.String(length=64), nullable=False),
        sa.Column("parent_user_id", sa.Integer(), nullable=True),
        sa.Column("child_id", sa.Integer(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("verdict", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("notes", sa.String(length=2000), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="recipe_feedback_rating_range"),
        sa.CheckConstraint("reviewer_type IN ('PARENT', 'CHILD')", name="recipe_feedback_reviewer_type"),
        sa.CheckConstraint(
            "(reviewer_type = 'PARENT' AND parent_user_id IS NOT NULL AND child_id IS NULL) OR "
            "(reviewer_type = 'CHILD' AND child_id IS NOT NULL AND parent_user_id IS NULL)",
            name="recipe_feedback_reviewer_target",
        ),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("recipe_id", "reviewer_type", "reviewer_key"),
    )
    op.create_index(op.f("ix_recipe_feedback_recipe_id"), "recipe_feedback", ["recipe_id"], unique=False)
    op.create_index(op.f("ix_recipe_feedback_household_id"), "recipe_feedback", ["household_id"], unique=False)
    op.create_index(op.f("ix_recipe_feedback_parent_user_id"), "recipe_feedback", ["parent_user_id"], unique=False)
    op.create_index(op.f("ix_recipe_feedback_child_id"), "recipe_feedback", ["child_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_recipe_feedback_child_id"), table_name="recipe_feedback")
    op.drop_index(op.f("ix_recipe_feedback_parent_user_id"), table_name="recipe_feedback")
    op.drop_index(op.f("ix_recipe_feedback_household_id"), table_name="recipe_feedback")
    op.drop_index(op.f("ix_recipe_feedback_recipe_id"), table_name="recipe_feedback")
    op.drop_table("recipe_feedback")
