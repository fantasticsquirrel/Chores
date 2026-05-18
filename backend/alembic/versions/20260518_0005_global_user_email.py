"""Enforce globally unique user emails.

Revision ID: 20260518_0005
Revises: 20260518_0004
Create Date: 2026-05-18 21:35:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260518_0005"
down_revision = "20260518_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return

    _rename_duplicate_emails(bind)
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ux_users_email" not in indexes:
        op.create_index("ux_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return

    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ux_users_email" in indexes:
        op.drop_index("ux_users_email", table_name="users")


def _rename_duplicate_emails(bind) -> None:
    rows = bind.execute(sa.text("SELECT id, lower(email) AS email FROM users ORDER BY lower(email), id")).mappings().all()
    seen: set[str] = set()
    existing = {row["email"] for row in rows}

    for row in rows:
        email = row["email"]
        if email not in seen:
            seen.add(email)
            continue

        user_id = row["id"]
        replacement = _unique_replacement_email(user_id, existing)
        bind.execute(sa.text("UPDATE users SET email = :email WHERE id = :id"), {"email": replacement, "id": user_id})
        existing.add(replacement)


def _unique_replacement_email(user_id: int, existing: set[str]) -> str:
    suffix = 0
    while True:
        candidate = f"duplicate-user-{user_id}{'-' + str(suffix) if suffix else ''}@child.local"
        if candidate not in existing:
            return candidate
        suffix += 1
