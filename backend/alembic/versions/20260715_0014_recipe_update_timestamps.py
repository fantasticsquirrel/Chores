"""Add recipe update timestamps missing from legacy runtime-created schemas.

Revision ID: 20260715_0014
Revises: 20260714_0013
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260715_0014"
down_revision = "20260714_0013"
branch_labels = None
depends_on = None

_TABLES = ("recipe_categories", "recipe_tags", "recipes")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table in _TABLES:
        if not inspector.has_table(table):
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "updated_at" not in columns:
            op.add_column(table, sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
        op.execute(sa.text(f"UPDATE {table} SET updated_at = created_at WHERE updated_at IS NULL"))

    if inspector.has_table("completion_records") and inspector.has_table("chores"):
        op.execute(sa.text("UPDATE completion_records SET occurrence_key = NULL WHERE status != 'APPROVED'"))
        op.execute(
            sa.text(
                """
                UPDATE completion_records AS current
                SET occurrence_key =
                    CASE
                        WHEN (SELECT completion_mode FROM chores WHERE chores.id = current.chore_id) = 'SHARED'
                        THEN 'household:' || current.household_id || ':chore:' || current.chore_id || ':date:' || current.date
                        ELSE 'child:' || current.child_id || ':chore:' || current.chore_id || ':date:' || current.date
                    END ||
                    CASE WHEN current.id != (
                        SELECT MIN(other.id)
                        FROM completion_records AS other
                        WHERE other.chore_id = current.chore_id
                          AND other.date = current.date
                          AND other.status = 'APPROVED'
                          AND (
                            ((SELECT completion_mode FROM chores WHERE chores.id = current.chore_id) = 'SHARED' AND other.household_id = current.household_id)
                            OR ((SELECT completion_mode FROM chores WHERE chores.id = current.chore_id) != 'SHARED' AND other.child_id = current.child_id)
                          )
                    ) THEN ':legacy:' || current.id ELSE '' END
                WHERE current.status = 'APPROVED'
                """
            )
        )


def downgrade() -> None:
    # Migration 0007 already owns these columns on fresh schemas. Retaining
    # compatibility columns is safer than dropping canonical schema fields.
    pass
