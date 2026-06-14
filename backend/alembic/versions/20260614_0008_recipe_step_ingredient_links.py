"""Add recipe step ingredient links.

Revision ID: 20260614_0008
Revises: 20260530_0007
Create Date: 2026-06-14 03:12:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260614_0008"
down_revision = "20260530_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "recipe_step_ingredient_links" in inspector.get_table_names():
        return
    if "recipe_steps" not in inspector.get_table_names() or "recipe_ingredients" not in inspector.get_table_names():
        return

    op.create_table(
        "recipe_step_ingredient_links",
        sa.Column("step_id", sa.Integer(), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["ingredient_id"], ["recipe_ingredients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["step_id"], ["recipe_steps.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("step_id", "ingredient_id"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "recipe_step_ingredient_links" in inspector.get_table_names():
        op.drop_table("recipe_step_ingredient_links")
