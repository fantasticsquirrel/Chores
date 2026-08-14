"""Bind application sessions to credential generations.

Revision ID: 20260813_0018
Revises: 20260811_0017
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260813_0018"
down_revision = "20260811_0017"
branch_labels = None
depends_on = None


_SESSION_GENERATION = "session_generation"
_IDENTITY_ARTIFACTS = frozenset(("users", "households", "auth_sessions"))
_RESET_TABLES = frozenset(("password_resets", "password_reset_requests", "password_reset_deliveries"))


def _has_complete_password_reset_schema(tables: set[str], *, operation: str) -> bool:
    """Allow a no-op only for a wholly absent identity/reset subsystem.

    This revision relies on 0017's reset footprint as part of the schema it
    advances. A stamped, complete identity schema without all reset tables is
    drift, not a historical no-op: adding/removing session columns there would
    let Alembic claim lifecycle ownership after an incomplete predecessor.
    """
    present_identity = sorted(tables & _IDENTITY_ARTIFACTS)
    present_reset = sorted(tables & _RESET_TABLES)
    if not present_identity and not present_reset:
        return False

    missing_identity = sorted(_IDENTITY_ARTIFACTS - tables)
    if missing_identity:
        raise RuntimeError(
            f"Session generation migration {operation} refuses incomplete identity schema "
            f"(missing: {', '.join(missing_identity)}; present: {', '.join(present_identity)})"
        )

    missing_reset = sorted(_RESET_TABLES - tables)
    if missing_reset:
        raise RuntimeError(
            f"Session generation migration {operation} refuses incomplete password reset schema "
            f"(missing: {', '.join(missing_reset)}; present: {', '.join(present_reset)})"
        )
    return True


def _columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    """Add the columns only when this revision can own their lifecycle.

    A similarly named pre-existing column could belong to an out-of-band schema
    change.  Treat that as drift and leave the database/version unchanged rather
    than later deleting an unowned column during downgrade.
    """
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    # Historical subsystem-only fixtures may advance only when all identity and
    # reset artifacts are absent. Any partial footprint is incompatible drift
    # and must fail before this revision mutates a table it cannot safely own.
    if not _has_complete_password_reset_schema(tables, operation="upgrade"):
        return

    existing = [
        f"{table}.{_SESSION_GENERATION}"
        for table in ("users", "auth_sessions")
        if _SESSION_GENERATION in _columns(inspector, table)
    ]
    if existing:
        raise RuntimeError(
            "Session generation migration refuses schema drift: tables already contain "
            + ", ".join(existing)
        )

    column = sa.Column(_SESSION_GENERATION, sa.Integer(), nullable=False, server_default=sa.text("0"))
    op.add_column("users", column)
    op.add_column(
        "auth_sessions",
        sa.Column(_SESSION_GENERATION, sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    """Remove only columns this revision created after validating its footprint."""
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    # Match the harmless upgrade path only for a truly empty identity/reset
    # subsystem; otherwise reject drift before any column is dropped.
    if not _has_complete_password_reset_schema(tables, operation="downgrade"):
        return

    missing = [
        f"{table}.{_SESSION_GENERATION}"
        for table in ("users", "auth_sessions")
        if _SESSION_GENERATION not in _columns(inspector, table)
    ]
    if missing:
        raise RuntimeError(
            "Session generation downgrade refuses incomplete schema: missing " + ", ".join(missing)
        )

    # SQLite 3.35+ preserves unrelated triggers for native DROP COLUMN, unlike
    # a batch table rebuild.  PostgreSQL uses its native equivalent.
    op.drop_column("auth_sessions", _SESSION_GENERATION)
    op.drop_column("users", _SESSION_GENERATION)
