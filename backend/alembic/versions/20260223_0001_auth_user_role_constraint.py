"""Add auth user role/child linkage constraint.

Revision ID: 20260223_0001
Revises:
Create Date: 2026-02-23 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260223_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return

    existing = {constraint["name"] for constraint in inspector.get_check_constraints("users")}
    constraint_name = "ck_users_user_role_child_link"
    if constraint_name in existing:
        return

    with op.batch_alter_table("users", recreate="always") as batch_op:
        batch_op.create_check_constraint(
            constraint_name,
            "(role = 'CHILD' AND child_id IS NOT NULL) OR (role IN ('PARENT_ADMIN', 'PARENT') AND child_id IS NULL)",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return

    existing = {constraint["name"] for constraint in inspector.get_check_constraints("users")}
    constraint_name = "ck_users_user_role_child_link"
    if constraint_name not in existing:
        return

    with op.batch_alter_table("users", recreate="always") as batch_op:
        batch_op.drop_constraint(constraint_name, type_="check")
