"""Add recipe organizer schema.

Revision ID: 20260530_0007
Revises: 20260518_0005
Create Date: 2026-05-30 00:07:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260530_0007"
down_revision = "20260518_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "recipe_categories" not in existing:
        op.create_table(
            "recipe_categories",
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("household_id", sa.Integer(), nullable=False),
            sa.Column("owner_user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("color", sa.String(length=32), nullable=False),
            sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("owner_user_id", "name"),
        )
        op.create_index(op.f("ix_recipe_categories_household_id"), "recipe_categories", ["household_id"], unique=False)
        op.create_index(op.f("ix_recipe_categories_owner_user_id"), "recipe_categories", ["owner_user_id"], unique=False)

    if "recipe_tags" not in existing:
        op.create_table(
            "recipe_tags",
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("household_id", sa.Integer(), nullable=False),
            sa.Column("owner_user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("owner_user_id", "name"),
        )
        op.create_index(op.f("ix_recipe_tags_household_id"), "recipe_tags", ["household_id"], unique=False)
        op.create_index(op.f("ix_recipe_tags_owner_user_id"), "recipe_tags", ["owner_user_id"], unique=False)

    if "recipes" not in existing:
        op.create_table(
            "recipes",
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("household_id", sa.Integer(), nullable=False),
            sa.Column("owner_user_id", sa.Integer(), nullable=False),
            sa.Column("parent_recipe_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.String(length=2000), nullable=False),
            sa.Column("source_name", sa.String(length=255), nullable=False),
            sa.Column("source_url", sa.String(length=1000), nullable=True),
            sa.Column("prep_minutes", sa.Integer(), nullable=True),
            sa.Column("cook_minutes", sa.Integer(), nullable=True),
            sa.Column("servings", sa.Float(), nullable=True),
            sa.Column("yield_quantity", sa.Float(), nullable=True),
            sa.Column("yield_unit", sa.String(length=64), nullable=False),
            sa.Column("rating", sa.Integer(), nullable=True),
            sa.Column("favorite", sa.Boolean(), nullable=False),
            sa.Column("notes", sa.String(length=4000), nullable=False),
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint("cook_minutes IS NULL OR cook_minutes >= 0", name="recipe_cook_minutes_non_negative"),
            sa.CheckConstraint("prep_minutes IS NULL OR prep_minutes >= 0", name="recipe_prep_minutes_non_negative"),
            sa.CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="recipe_rating_range"),
            sa.CheckConstraint("servings IS NULL OR servings > 0", name="recipe_servings_positive"),
            sa.CheckConstraint("yield_quantity IS NULL OR yield_quantity > 0", name="recipe_yield_quantity_positive"),
            sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["parent_recipe_id"], ["recipes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_recipes_household_id"), "recipes", ["household_id"], unique=False)
        op.create_index(op.f("ix_recipes_owner_user_id"), "recipes", ["owner_user_id"], unique=False)
        op.create_index(op.f("ix_recipes_parent_recipe_id"), "recipes", ["parent_recipe_id"], unique=False)
        op.create_index(op.f("ix_recipes_title"), "recipes", ["title"], unique=False)

    existing = set(sa.inspect(bind).get_table_names())
    if "recipe_category_links" not in existing:
        op.create_table(
            "recipe_category_links",
            sa.Column("recipe_id", sa.Integer(), nullable=False),
            sa.Column("category_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["category_id"], ["recipe_categories.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("recipe_id", "category_id"),
        )
    if "recipe_tag_links" not in existing:
        op.create_table(
            "recipe_tag_links",
            sa.Column("recipe_id", sa.Integer(), nullable=False),
            sa.Column("tag_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tag_id"], ["recipe_tags.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("recipe_id", "tag_id"),
        )
    if "recipe_ingredients" not in existing:
        op.create_table(
            "recipe_ingredients",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("recipe_id", sa.Integer(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("group_name", sa.String(length=100), nullable=False),
            sa.Column("quantity", sa.Float(), nullable=True),
            sa.Column("unit", sa.String(length=64), nullable=False),
            sa.Column("item", sa.String(length=255), nullable=False),
            sa.Column("preparation", sa.String(length=255), nullable=False),
            sa.Column("note", sa.String(length=500), nullable=False),
            sa.Column("is_optional", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("recipe_id", "position"),
        )
        op.create_index(op.f("ix_recipe_ingredients_recipe_id"), "recipe_ingredients", ["recipe_id"], unique=False)
    if "recipe_steps" not in existing:
        op.create_table(
            "recipe_steps",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("recipe_id", sa.Integer(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("section", sa.String(length=100), nullable=False),
            sa.Column("instruction", sa.String(length=2000), nullable=False),
            sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("recipe_id", "position"),
        )
        op.create_index(op.f("ix_recipe_steps_recipe_id"), "recipe_steps", ["recipe_id"], unique=False)
    if "recipe_components" not in existing:
        op.create_table(
            "recipe_components",
            sa.Column("parent_recipe_id", sa.Integer(), nullable=False),
            sa.Column("component_recipe_id", sa.Integer(), nullable=False),
            sa.Column("label", sa.String(length=100), nullable=False),
            sa.Column("quantity", sa.Float(), nullable=True),
            sa.Column("unit", sa.String(length=64), nullable=False),
            sa.CheckConstraint("parent_recipe_id != component_recipe_id", name="recipe_component_not_self"),
            sa.ForeignKeyConstraint(["component_recipe_id"], ["recipes.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["parent_recipe_id"], ["recipes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("parent_recipe_id", "component_recipe_id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    for table in (
        "recipe_components",
        "recipe_steps",
        "recipe_ingredients",
        "recipe_tag_links",
        "recipe_category_links",
        "recipes",
        "recipe_tags",
        "recipe_categories",
    ):
        if table in existing:
            op.drop_table(table)
